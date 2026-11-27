import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { handleAgentSignalRequest, verifyBearerToken } from "./agent-signal.server.ts";
import type { Sql } from "./db.ts";

async function createTestSql(): Promise<Sql> {
  const pg = new PGlite();
  await pg.waitReady;
  const migration = readFileSync(join(process.cwd(), "migrations", "0009_agent_signals.sql"), "utf8");
  const migration10 = readFileSync(
    join(process.cwd(), "migrations", "0010_agent_signals_approved_status.sql"),
    "utf8",
  );
  await pg.exec(migration);
  await pg.exec(migration10);
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
  sql.transaction = async () => {
    throw new Error("Not needed in unit test");
  };
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

test("POST /api/intake/agent-signal persists structured signal and deduplicates by idempotencyKey", async () => {
  const sql = await createTestSql();
  const body = {
    sourceAgent: "grok",
    signalType: "venue_lead",
    title: "The Basement East — Fall booking window open",
    summary: "Official booking page lists October/November support slots.",
    sourceUrl: "https://www.thebasementnashville.com/booking",
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
  const firstJson = (await first.json()) as { ok: boolean; id: string; status: string };
  assert.equal(firstJson.ok, true);
  assert.equal(firstJson.status, "new");

  const duplicate = await handleAgentSignalRequest(makeReq(), {
    secret: "test-secret",
    sqlProvider: async () => sql,
  });
  assert.equal(duplicate.status, 200);
  const dupJson = (await duplicate.json()) as { ok: boolean; deduplicated: boolean };
  assert.equal(dupJson.ok, true);
  assert.equal(dupJson.deduplicated, true);

  const rows = await sql.query<{ source_agent: string; title: string; payload: { capacity: number } }>(
    "select source_agent, title, payload from public.agent_signals",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_agent, "grok");
  assert.equal(rows[0].payload.capacity, 400);

  const approved = await sql.query<{ status: string; reviewed_by: string | null }>(
    "update public.agent_signals set status = 'approved', reviewed_by = 'artist-1', reviewed_at = now() where id = $1 returning status, reviewed_by",
    [firstJson.id],
  );
  assert.equal(approved[0]?.status, "approved");
  assert.equal(approved[0]?.reviewed_by, "artist-1");
});
