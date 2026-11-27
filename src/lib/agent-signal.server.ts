import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  normalizeSignalScoring,
  SIGNAL_PRIORITIES,
  SIGNAL_URGENCIES,
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
  const scoring = normalizeSignalScoring({
    signalType: data.signalType,
    summary: data.summary,
    sourceUrl: data.sourceUrl,
    payload: data.payload,
    fitScore: data.fitScore,
    priorityTier: data.priorityTier,
    urgency: data.urgency,
    recommendedAction: data.recommendedAction,
  });
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
         idempotency_key, fit_score, priority_tier, urgency, recommended_action, dedupe_fingerprint
       ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
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
