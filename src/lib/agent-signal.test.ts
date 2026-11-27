import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  computePreShowYield,
  computeRoutingGapFit,
  computeSignalScore,
  filterAndSortSignals,
  normalizeSignalScoring,
} from "./agent-signal-scoring.ts";
import {
  buildDedupeFingerprint,
  handleAgentSignalRequest,
  verifyBearerToken,
} from "./agent-signal.server.ts";
import { convertSignalToLeadInDb } from "./agent-signal-convert.server.ts";
import type { Sql } from "./db.ts";

async function createTestSql(): Promise<Sql> {
  const pg = new PGlite();
  await pg.waitReady;
  for (const file of [
    "0001_auth.sql",
    "0002_app_state.sql",
    "0009_agent_signals.sql",
    "0010_agent_signals_approved_status.sql",
    "0011_agent_signals_scoring.sql",
    "0012_agent_signals_conversion.sql",
    "0013_band_booking_routing.sql",
    "0014_routing_gap_and_yield.sql",
  ]) {
    await pg.exec(readFileSync(join(process.cwd(), "migrations", file), "utf8"));
  }
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return (await pg.query<T>(text, values)).rows;
  }) as unknown as Sql;
  sql.query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await pg.query<T>(text, params)).rows;
  sql.transaction = async <T>(work: (tx: Sql) => Promise<T>) =>
    pg.transaction((tx) => {
      const txSql = (async <R = Record<string, unknown>>(
        strings: TemplateStringsArray,
        ...values: unknown[]
      ): Promise<R[]> => {
        let text = strings[0];
        for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
        return (await tx.query<R>(text, values)).rows;
      }) as unknown as Sql;
      txSql.query = async <R = Record<string, unknown>>(text: string, params: unknown[] = []) =>
        (await tx.query<R>(text, params)).rows;
      txSql.transaction = async () => {
        throw new Error("Nested tx unsupported");
      };
      return work(txSql);
    });
  return sql;
}

test("verifyBearerToken enforces exact Bearer match", () => {
  assert.equal(verifyBearerToken("Bearer super-secret-token", "super-secret-token"), true);
  assert.equal(verifyBearerToken("bearer super-secret-token", "super-secret-token"), true);
  assert.equal(verifyBearerToken("Bearer wrong-token", "super-secret-token"), false);
  assert.equal(verifyBearerToken("Basic super-secret-token", "super-secret-token"), false);
  assert.equal(verifyBearerToken(null, "super-secret-token"), false);
  assert.equal(verifyBearerToken("Bearer super-secret-token", ""), false);
});

test("deterministic signal scoring ranks high-leverage leads above smoke tests", () => {
  const highLead = normalizeSignalScoring({
    signalType: "venue_lead",
    summary: "Official booking page lists open October support slots.",
    sourceUrl: "https://www.thebasementnashville.com/booking",
    urgency: "high",
    recommendedAction: "Draft pitch with Nashville draw stats",
    payload: { city: "Nashville, TN", capacity: 400, bookingEmail: "book@example.com" },
  });
  assert.ok(highLead.fitScore >= 85, `expected high score, got ${highLead.fitScore}`);
  assert.equal(highLead.priorityTier, "high");

  const lowSmoke = normalizeSignalScoring({
    signalType: "smoke_test",
    summary: "ping",
  });
  assert.ok(lowSmoke.fitScore < 45, `expected low score, got ${lowSmoke.fitScore}`);
  assert.equal(lowSmoke.priorityTier, "low");

  const urgentOverride = normalizeSignalScoring({
    signalType: "market_intel",
    urgency: "urgent",
    fitScore: 60,
  });
  assert.equal(urgentOverride.fitScore, 60);
  assert.equal(urgentOverride.priorityTier, "high");
  assert.equal(computeSignalScore({ signalType: "venue_lead", fitScore: 140 }), 100);
});

test("filterAndSortSignals defaults to highest score and filters by status and priority", () => {
  const items = [
    { id: "a", status: "new", fitScore: 40, priorityTier: "low" as const, receivedAt: "2026-11-27T12:00:00Z" },
    { id: "b", status: "new", fitScore: 92, priorityTier: "high" as const, receivedAt: "2026-11-26T12:00:00Z" },
    { id: "c", status: "archived", fitScore: 88, priorityTier: "high" as const, receivedAt: "2026-11-27T14:00:00Z" },
    { id: "d", status: "approved", fitScore: 70, priorityTier: "medium" as const, receivedAt: "2026-11-27T13:00:00Z" },
  ];

  assert.deepEqual(
    filterAndSortSignals(items, { statusFilter: "all", priorityFilter: "all", sortMode: "score" }).map((i) => i.id),
    ["b", "c", "d", "a"],
  );
  assert.deepEqual(
    filterAndSortSignals(items, { statusFilter: "all", priorityFilter: "all", sortMode: "newest" }).map((i) => i.id),
    ["c", "d", "a", "b"],
  );
  assert.deepEqual(
    filterAndSortSignals(items, { statusFilter: "new", priorityFilter: "high", sortMode: "score" }).map((i) => i.id),
    ["b"],
  );
});

test("POST /api/intake/agent-signal rejects missing secret, bad token, and X/Twitter URLs", async () => {
  const sql = await createTestSql();
  const makeReq = (body: unknown, token?: string) =>
    new Request("https://primal-directive-loose-ends-co.vercel.app/api/intake/agent-signal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const unconfigured = await handleAgentSignalRequest(makeReq({}), {
    secret: "",
    sqlProvider: async () => sql,
  });
  assert.equal(unconfigured.status, 503);

  const unauthorized = await handleAgentSignalRequest(makeReq({}, "wrong"), {
    secret: "test-secret",
    sqlProvider: async () => sql,
  });
  assert.equal(unauthorized.status, 401);

  const blockedUrl = await handleAgentSignalRequest(
    makeReq(
      {
        sourceAgent: "grok",
        signalType: "venue_lead",
        title: "Blocked X link",
        sourceUrl: "https://x.com/somevenue/status/123",
      },
      "test-secret",
    ),
    { secret: "test-secret", sqlProvider: async () => sql },
  );
  assert.equal(blockedUrl.status, 400);
});

test("POST /api/intake/agent-signal persists score/enrichment, deduplicates, and supports approve/archive", async () => {
  const sql = await createTestSql();
  const body = {
    sourceAgent: "grok",
    signalType: "venue_lead",
    title: "The Basement East — Fall booking window open",
    summary: "Official booking page lists October/November support slots.",
    sourceUrl: "https://www.thebasementnashville.com/booking",
    urgency: "high" as const,
    recommendedAction: "Send EPK + Nashville draw history to talent buyer",
    idempotencyKey: "grok-basement-east-2026-11-27",
    payload: { city: "Nashville, TN", capacity: 400 },
  };
  const makeReq = () =>
    new Request("https://primal-directive-loose-ends-co.vercel.app/api/intake/agent-signal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-secret",
      },
      body: JSON.stringify(body),
    });

  const first = await handleAgentSignalRequest(makeReq(), {
    secret: "test-secret",
    sqlProvider: async () => sql,
  });
  assert.equal(first.status, 201);
  const firstJson = (await first.json()) as {
    ok: boolean;
    id: string;
    status: string;
    fitScore: number;
    priorityTier: string;
    urgency: string;
  };
  assert.equal(firstJson.ok, true);
  assert.equal(firstJson.status, "new");
  assert.ok(firstJson.fitScore >= 85);
  assert.equal(firstJson.priorityTier, "high");
  assert.equal(firstJson.urgency, "high");

  const duplicate = await handleAgentSignalRequest(makeReq(), {
    secret: "test-secret",
    sqlProvider: async () => sql,
  });
  assert.equal(duplicate.status, 200);
  const dupJson = (await duplicate.json()) as { ok: boolean; deduplicated: boolean };
  assert.equal(dupJson.ok, true);
  assert.equal(dupJson.deduplicated, true);

  const rows = await sql.query<{
    source_agent: string;
    fit_score: number;
    priority_tier: string;
    recommended_action: string | null;
    dedupe_fingerprint: string | null;
    payload: { capacity: number };
  }>(
    "select source_agent, fit_score, priority_tier, recommended_action, dedupe_fingerprint, payload from public.agent_signals",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_agent, "grok");
  assert.equal(rows[0].fit_score, firstJson.fitScore);
  assert.equal(rows[0].priority_tier, "high");
  assert.equal(rows[0].recommended_action, body.recommendedAction);
  assert.equal(rows[0].dedupe_fingerprint, buildDedupeFingerprint(body));
  assert.equal(rows[0].payload.capacity, 400);

  const approved = await sql.query<{ status: string; reviewed_by: string | null }>(
    "update public.agent_signals set status = 'approved', reviewed_by = 'artist-1', reviewed_at = now() where id = $1 returning status, reviewed_by",
    [firstJson.id],
  );
  assert.equal(approved[0]?.status, "approved");
  assert.equal(approved[0]?.reviewed_by, "artist-1");

  const archived = await sql.query<{ status: string }>(
    "update public.agent_signals set status = 'archived', reviewed_by = 'artist-1', reviewed_at = now() where id = $1 returning status",
    [firstJson.id],
  );
  assert.equal(archived[0]?.status, "archived");
});

test("convertSignalToLeadInDb creates one status='lead' gig in app_state and is idempotent on retry", async () => {
  const sql = await createTestSql();
  await sql.query(
    `insert into "user" ("id", "name", "email", "emailVerified") values ('artist-1', 'Test Band', 'band@example.com', true)`,
  );
  const req = new Request("https://primal-directive-loose-ends-co.vercel.app/api/intake/agent-signal", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-secret" },
    body: JSON.stringify({
      sourceAgent: "lead-scout-bot",
      signalType: "venue_lead",
      title: "The Local — Nashville band showcase slot",
      summary: "Independent songwriter/band lounge accepting EPKs and local draw history.",
      sourceUrl: "https://localnash.com",
      corridor: "Nashville / Middle TN",
      billRole: "co_bill",
      targetWindow: "Q1 2027 Weekends",
      dealType: "door_split",
      idempotencyKey: "band-convert-test-1",
      payload: { venue: "The Local", city: "Nashville, TN", guarantee: 650 },
    }),
  });
  const created = await handleAgentSignalRequest(req, {
    secret: "test-secret",
    sqlProvider: async () => sql,
  });
  assert.equal(created.status, 201);
  const { id: signalId } = (await created.json()) as { id: string };

  const first = await convertSignalToLeadInDb(sql, {
    signalId,
    userId: "artist-1",
    anchorGapNote: "Bridges Nashville -> Asheville",
    gapFitScore: 88,
  });
  assert.equal(first.alreadyConverted, false);
  assert.equal(first.row.status, "imported");
  assert.equal(first.gig?.status, "lead");
  assert.equal(first.gig?.venue, "The Local");
  assert.equal(first.gig?.city, "Nashville, TN");
  assert.equal(first.gig?.fee, 650);
  assert.equal(first.gig?.corridor, "Nashville / Middle TN");
  assert.equal(first.gig?.billRole, "co_bill");
  assert.equal(first.gig?.targetWindow, "Q1 2027 Weekends");
  assert.equal(first.gig?.dealType, "door_split");
  assert.equal(first.gig?.bookingStage, "lead");
  assert.equal(first.gig?.guaranteeOrSplitEst, 650);
  assert.equal(first.gig?.anchorGapNote, "Bridges Nashville -> Asheville");
  assert.equal(first.gig?.gapFitScore, 88);
  assert.ok(first.gig?.outreachDraft?.includes("The Local"));

  const second = await convertSignalToLeadInDb(sql, { signalId, userId: "artist-1" });
  assert.equal(second.alreadyConverted, true);
  assert.equal(second.gigId, first.gigId);

  const [stateRow] = await sql.query<{
    state: { gigs: Array<{ id: string; status: string; guaranteeOrSplitEst?: number; gapFitScore?: number }> };
  }>("select state from public.app_state where user_id = 'artist-1'");
  assert.equal(stateRow.state.gigs.length, 1);
  assert.equal(stateRow.state.gigs[0].id, first.gigId);
  assert.equal(stateRow.state.gigs[0].status, "lead");
  assert.equal(stateRow.state.gigs[0].guaranteeOrSplitEst, 650);
  assert.equal(stateRow.state.gigs[0].gapFitScore, 88);
});

test("computeRoutingGapFit scores corridor/window alignment and returns null without anchors", () => {
  const signal = {
    title: "One World Brewing — Asheville routing slot",
    summary: "Regional stop along I-40 between Knoxville and Carolinas.",
    corridor: "I-40 (Nashville -> Knoxville -> Asheville)",
    targetWindow: "Spring 2027 Routing",
  };
  assert.equal(computeRoutingGapFit(signal, {}).gapFitScore, null);

  const strong = computeRoutingGapFit(signal, {
    prevCity: "Nashville, TN",
    prevDate: "2027-04-02",
    nextCity: "Asheville, NC",
    nextDate: "2027-04-05",
  });
  assert.ok((strong.gapFitScore ?? 0) >= 85, `expected strong gap fit, got ${strong.gapFitScore}`);
  assert.equal(strong.gapLabel, "Strong gap fit");

  const offCorridor = computeRoutingGapFit(
    {
      title: "Seattle Club Night",
      corridor: "Pacific Northwest",
      targetWindow: "2027-09-15",
    },
    {
      prevCity: "Nashville, TN",
      prevDate: "2027-04-02",
      nextCity: "Asheville, NC",
      nextDate: "2027-04-05",
    },
  );
  assert.ok((offCorridor.gapFitScore ?? 100) < 45);
  assert.equal(offCorridor.gapLabel, "Off-corridor");
});

test("computePreShowYield calculates net yield and break-even attendance/merch accurately", () => {
  const profitable = computePreShowYield({
    guaranteeOrSplitEst: 500,
    estAttendance: 80,
    merchPerHeadEst: 6,
    roadAndRoomCostEst: 620,
  });
  assert.equal(profitable.merchGrossEst, 480);
  assert.equal(profitable.totalGrossEst, 980);
  assert.equal(profitable.netYieldEst, 360);
  assert.equal(profitable.breakEvenAttendance, 20);
  assert.equal(profitable.breakEvenMerchPerHead, 1.5);

  const coveredByGuarantee = computePreShowYield({
    guaranteeOrSplitEst: 1000,
    estAttendance: 50,
    merchPerHeadEst: 5,
    roadAndRoomCostEst: 400,
  });
  assert.equal(coveredByGuarantee.netYieldEst, 850);
  assert.equal(coveredByGuarantee.breakEvenAttendance, 0);
  assert.equal(coveredByGuarantee.breakEvenMerchPerHead, 0);
});
