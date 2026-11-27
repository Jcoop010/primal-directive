import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  normalizeSignalScoring,
  type SignalPriorityTier,
  type SignalUrgency,
} from "./agent-signal-scoring";
import { authMiddleware } from "./auth/middleware";
import { getSql } from "./db";
import type { Gig } from "./types";

export const AGENT_SIGNAL_STATUSES = [
  "new",
  "reviewed",
  "approved",
  "imported",
  "archived",
  "rejected",
] as const;

export type AgentSignalStatus = (typeof AGENT_SIGNAL_STATUSES)[number];

export interface AgentSignalRow {
  id: string;
  sourceAgent: string;
  signalType: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  payloadJson: string;
  status: AgentSignalStatus;
  fitScore: number;
  priorityTier: SignalPriorityTier;
  urgency: SignalUrgency;
  recommendedAction: string | null;
  dedupeFingerprint: string | null;
  idempotencyKey: string | null;
  receivedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  convertedGigId: string | null;
  convertedAt: string | null;
  convertedBy: string | null;
}

const statusUpdateSchema = z.object({
  id: z.string().trim().min(1).max(128),
  status: z.enum(AGENT_SIGNAL_STATUSES),
});

const convertSignalSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

interface RawSignalRow {
  id: string;
  source_agent: string;
  signal_type: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  fit_score: number | null;
  priority_tier: string | null;
  urgency: string | null;
  recommended_action: string | null;
  dedupe_fingerprint: string | null;
  idempotency_key: string | null;
  received_at: string | Date;
  reviewed_by: string | null;
  reviewed_at: string | Date | null;
  converted_gig_id: string | null;
  converted_at: string | Date | null;
  converted_by: string | null;
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapSignalRow(row: RawSignalRow): AgentSignalRow {
  const payloadObj = row.payload && typeof row.payload === "object" ? row.payload : {};
  const payloadJson =
    Object.keys(payloadObj).length > 0 ? JSON.stringify(payloadObj, null, 2) : "";
  const scoring = normalizeSignalScoring({
    signalType: row.signal_type,
    summary: row.summary,
    sourceUrl: row.source_url,
    payload: payloadObj,
    fitScore: row.fit_score,
    priorityTier:
      row.priority_tier === "high" ||
      row.priority_tier === "medium" ||
      row.priority_tier === "low"
        ? row.priority_tier
        : null,
    urgency:
      row.urgency === "urgent" ||
      row.urgency === "high" ||
      row.urgency === "normal" ||
      row.urgency === "low"
        ? row.urgency
        : null,
    recommendedAction: row.recommended_action,
  });

  const status = (AGENT_SIGNAL_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as AgentSignalStatus)
    : "new";

  return {
    id: row.id,
    sourceAgent: row.source_agent,
    signalType: row.signal_type,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    payloadJson,
    status,
    fitScore: scoring.fitScore,
    priorityTier: scoring.priorityTier,
    urgency: scoring.urgency,
    recommendedAction: scoring.recommendedAction,
    dedupeFingerprint: row.dedupe_fingerprint,
    idempotencyKey: row.idempotency_key,
    receivedAt: toIso(row.received_at) ?? new Date().toISOString(),
    reviewedBy: row.reviewed_by,
    reviewedAt: toIso(row.reviewed_at),
    convertedGigId: row.converted_gig_id ?? null,
    convertedAt: toIso(row.converted_at),
    convertedBy: row.converted_by ?? null,
  };
}

export const listAgentSignals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<{ signals: AgentSignalRow[] }> => {
    const sql = await getSql();
    const rows = await sql.query<RawSignalRow>(
      `select id, source_agent, signal_type, title, summary, source_url, payload,
              status, fit_score, priority_tier, urgency, recommended_action, dedupe_fingerprint,
              idempotency_key, received_at, reviewed_by, reviewed_at,
              converted_gig_id, converted_at, converted_by
       from public.agent_signals
       order by fit_score desc, received_at desc
       limit 100`,
    );
    return { signals: rows.map(mapSignalRow) };
  });

export const updateAgentSignalStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((raw: unknown) => statusUpdateSchema.parse(raw))
  .handler(async ({ data, context }): Promise<{ signal: AgentSignalRow }> => {
    const sql = await getSql();
    const rows = await sql.query<RawSignalRow>(
      `update public.agent_signals
       set status = $2, reviewed_by = $3, reviewed_at = now()
       where id = $1
       returning id, source_agent, signal_type, title, summary, source_url, payload,
                 status, fit_score, priority_tier, urgency, recommended_action, dedupe_fingerprint,
                 idempotency_key, received_at, reviewed_by, reviewed_at,
                 converted_gig_id, converted_at, converted_by`,
      [data.id, data.status, context.userId],
    );
    if (!rows[0]) {
      throw new Error("Signal not found.");
    }
    return { signal: mapSignalRow(rows[0]) };
  });

export const convertAgentSignalToLead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((raw: unknown) => convertSignalSchema.parse(raw))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      signal: AgentSignalRow;
      gigId: string;
      gig: Gig | null;
      alreadyConverted: boolean;
    }> => {
      const sql = await getSql();
      const { convertSignalToLeadInDb } = await import("./agent-signal-convert.server");
      const result = await convertSignalToLeadInDb(sql, {
        signalId: data.id,
        userId: context.userId,
      });
      return {
        signal: mapSignalRow(result.row),
        gigId: result.gigId,
        gig: result.gig,
        alreadyConverted: result.alreadyConverted,
      };
    },
  );
