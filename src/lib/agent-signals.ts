import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "./auth/middleware";
import { getSql } from "./db";

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
  idempotencyKey: string | null;
  receivedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

const statusUpdateSchema = z.object({
  id: z.string().trim().min(1).max(128),
  status: z.enum(AGENT_SIGNAL_STATUSES),
});

interface RawSignalRow {
  id: string;
  source_agent: string;
  signal_type: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  payload: Record<string, unknown> | null;
  status: AgentSignalStatus;
  idempotency_key: string | null;
  received_at: string | Date;
  reviewed_by: string | null;
  reviewed_at: string | Date | null;
}

function mapSignalRow(row: RawSignalRow): AgentSignalRow {
  const payloadObj = row.payload && typeof row.payload === "object" ? row.payload : {};
  const payloadJson =
    Object.keys(payloadObj).length > 0 ? JSON.stringify(payloadObj, null, 2) : "";
  return {
    id: row.id,
    sourceAgent: row.source_agent,
    signalType: row.signal_type,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    payloadJson,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    receivedAt:
      row.received_at instanceof Date ? row.received_at.toISOString() : String(row.received_at),
    reviewedBy: row.reviewed_by,
    reviewedAt:
      row.reviewed_at instanceof Date
        ? row.reviewed_at.toISOString()
        : row.reviewed_at
          ? String(row.reviewed_at)
          : null,
  };
}

export const listAgentSignals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<{ signals: AgentSignalRow[] }> => {
    const sql = await getSql();
    const rows = await sql.query<RawSignalRow>(
      `select id, source_agent, signal_type, title, summary, source_url, payload,
              status, idempotency_key, received_at, reviewed_by, reviewed_at
       from public.agent_signals
       order by received_at desc
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
                 status, idempotency_key, received_at, reviewed_by, reviewed_at`,
      [data.id, data.status, context.userId],
    );
    if (!rows[0]) {
      throw new Error("Signal not found.");
    }
    return { signal: mapSignalRow(rows[0]) };
  });
