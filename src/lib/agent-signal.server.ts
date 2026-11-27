import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  buildBookingOutreachDraft,
  normalizeSignalScoring,
  SIGNAL_BILL_ROLES,
  SIGNAL_DEAL_TYPES,
  SIGNAL_PRIORITIES,
  SIGNAL_URGENCIES,
  type SignalBillRole,
  type SignalDealType,
} from "./agent-signal-scoring.ts";
import type { Sql } from "./db.ts";

const MAX_BODY_BYTES = 100_000;
const BLOCKED_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

function isAllowedSourceUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host) || host.endsWith(".twitter.com") || host.endsWith(".x.com")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const agentSignalSchema = z.object({
  sourceAgent: z.string().trim().min(1).max(64),
  signalType: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(4000).optional(),
  sourceUrl: z
    .string()
    .trim()
    .max(2048)
    .refine(isAllowedSourceUrl, "sourceUrl must be a valid non-X/Twitter http(s) URL")
    .optional(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
  fitScore: z.number().min(0).max(100).optional(),
  priorityTier: z.enum(SIGNAL_PRIORITIES).optional(),
  urgency: z.enum(SIGNAL_URGENCIES).optional(),
  recommendedAction: z.string().trim().max(300).optional(),
  corridor: z.string().trim().max(160).optional(),
  billRole: z.enum(SIGNAL_BILL_ROLES).optional(),
  targetWindow: z.string().trim().max(120).optional(),
  dealType: z.enum(SIGNAL_DEAL_TYPES).optional(),
  outreachDraft: z.string().trim().max(6000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type AgentSignalInput = z.infer<typeof agentSignalSchema>;

export function buildDedupeFingerprint(input: {
  sourceAgent: string;
  signalType: string;
  title: string;
  sourceUrl?: string | null;
}): string {
  const canonical = [
    input.sourceAgent.trim().toLowerCase(),
    input.signalType.trim().toLowerCase(),
    input.title.trim().toLowerCase(),
    (input.sourceUrl ?? "").trim().toLowerCase(),
  ].join("|");
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 32);
}

export function verifyBearerToken(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader || !expectedSecret) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return false;
  const provided = match[1].trim();
  if (!provided) return false;
  // Hash both sides to a fixed 32-byte digest so timingSafeEqual never leaks secret length.
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expectedSecret, "utf8").digest();
  return timingSafeEqual(a, b);
}

function readPayloadString(payload: Record<string, unknown> | undefined, keys: readonly string[]): string | null {
  if (!payload) return null;
  for (const key of keys) {
    const val = payload[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

export async function handleAgentSignalRequest(
  request: Request,
  options?: {
    secret?: string;
    sqlProvider?: () => Promise<Sql>;
  },
): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  const secret = (options?.secret ?? process.env.AGENT_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    return Response.json(
      { ok: false, error: "Agent webhook intake is not configured" },
      { status: 503, headers },
    );
  }

  if (!verifyBearerToken(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "Payload too large" }, { status: 413, headers });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "Payload too large" }, { status: 413, headers });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400, headers });
  }

  const validated = agentSignalSchema.safeParse(parsedJson);
  if (!validated.success) {
    return Response.json(
      {
        ok: false,
        error: "Invalid agent signal payload",
        issues: validated.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400, headers },
    );
  }

  const data = validated.data;
  const corridor =
    data.corridor ?? readPayloadString(data.payload, ["corridor", "routingFit", "cityRegion"]);
  const rawRole = data.billRole ?? readPayloadString(data.payload, ["billRole"]);
  const billRole: SignalBillRole | null =
    rawRole && (SIGNAL_BILL_ROLES as readonly string[]).includes(rawRole)
      ? (rawRole as SignalBillRole)
      : null;
  const targetWindow =
    data.targetWindow ?? readPayloadString(data.payload, ["targetWindow", "deadline", "date"]);
  const rawDeal = data.dealType ?? readPayloadString(data.payload, ["dealType"]);
  const dealType: SignalDealType | null =
    rawDeal && (SIGNAL_DEAL_TYPES as readonly string[]).includes(rawDeal)
      ? (rawDeal as SignalDealType)
      : null;

  const scoring = normalizeSignalScoring({
    signalType: data.signalType,
    summary: data.summary,
    sourceUrl: data.sourceUrl,
    payload: data.payload,
    fitScore: data.fitScore,
    priorityTier: data.priorityTier,
    urgency: data.urgency,
    recommendedAction: data.recommendedAction,
    corridor,
    billRole,
    targetWindow,
    dealType,
  });

  const venueName =
    readPayloadString(data.payload, ["venue", "festival", "promoter"]) ??
    data.title.split("—")[0]?.trim() ??
    data.title;
  const cityName = readPayloadString(data.payload, ["city", "market", "region"]);
  const outreachDraft =
    data.outreachDraft ??
    (data.signalType === "smoke_test"
      ? null
      : buildBookingOutreachDraft({
          venue: venueName,
          city: cityName,
          corridor,
          billRole,
          targetWindow,
          dealType,
          recommendedAction: scoring.recommendedAction,
        }));

  const dedupeFingerprint = buildDedupeFingerprint(data);
  const id = randomUUID();

  try {
    const sql = options?.sqlProvider
      ? await options.sqlProvider()
      : await (await import("./db.ts")).getSql();
    const inserted = await sql.query<{
      id: string;
      status: string;
      fit_score: number;
      priority_tier: string;
      urgency: string;
      received_at: string;
    }>(
      `insert into public.agent_signals (
         id, source_agent, signal_type, title, summary, source_url, payload,
         idempotency_key, fit_score, priority_tier, urgency, recommended_action, dedupe_fingerprint,
         corridor, bill_role, target_window, deal_type, outreach_draft
       ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       on conflict (idempotency_key) do nothing
       returning id, status, fit_score, priority_tier, urgency, received_at`,
      [
        id,
        data.sourceAgent,
        data.signalType,
        data.title,
        data.summary ?? null,
        data.sourceUrl ?? null,
        JSON.stringify(data.payload ?? {}),
        data.idempotencyKey ?? null,
        scoring.fitScore,
        scoring.priorityTier,
        scoring.urgency,
        scoring.recommendedAction,
        dedupeFingerprint,
        corridor,
        billRole,
        targetWindow,
        dealType,
        outreachDraft,
      ],
    );

    if (inserted.length === 0 && data.idempotencyKey) {
      return Response.json(
        { ok: true, deduplicated: true, idempotencyKey: data.idempotencyKey },
        { status: 200, headers },
      );
    }

    const row = inserted[0];
    return Response.json(
      {
        ok: true,
        id: row?.id ?? id,
        status: row?.status ?? "new",
        fitScore: row?.fit_score ?? scoring.fitScore,
        priorityTier: row?.priority_tier ?? scoring.priorityTier,
        urgency: row?.urgency ?? scoring.urgency,
        receivedAt: row?.received_at ?? new Date().toISOString(),
      },
      { status: 201, headers },
    );
  } catch (error) {
    console.error("[intake] failed to persist agent signal", {
      sourceAgent: data.sourceAgent,
      signalType: data.signalType,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      { ok: false, error: "Failed to persist agent signal" },
      { status: 500, headers },
    );
  }
}
