import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Sql } from "./db.ts";

const MAX_BODY_BYTES = 100_000;
const BLOCKED_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"]);

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
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type AgentSignalInput = z.infer<typeof agentSignalSchema>;

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
  const id = randomUUID();
  try {
    const sql = options?.sqlProvider
      ? await options.sqlProvider()
      : await (await import("./db.ts")).getSql();
    const inserted = await sql.query<{ id: string; status: string; received_at: string }>(
      `insert into public.agent_signals (
         id, source_agent, signal_type, title, summary, source_url, payload, idempotency_key
       ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       on conflict (idempotency_key) do nothing
       returning id, status, received_at`,
      [
        id,
        data.sourceAgent,
        data.signalType,
        data.title,
        data.summary ?? null,
        data.sourceUrl ?? null,
        JSON.stringify(data.payload ?? {}),
        data.idempotencyKey ?? null,
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
