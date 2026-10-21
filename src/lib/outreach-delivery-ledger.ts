import { getSql } from "./db";
import type { SendAuditStatus } from "./outreach-audit";

/** Durable, account-scoped send ledger. Never auto-retry reserved/unknown delivery.
 * Transport must reserve before sending and record the provider receipt afterwards.
 * A reservation alone is NOT authorization to send an email.
 */
export async function reserveOutreachDelivery(input: {
  userId: string; gigId: string; recipient: string; idempotencyKey: string;
}): Promise<boolean> {
  if (!input.userId || !input.gigId || !input.idempotencyKey || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient)) {
    throw new Error("Invalid outreach reservation");
  }
  const sql = await getSql();
  await sql.query(`CREATE TABLE IF NOT EXISTS outreach_delivery_audit (
    idempotency_key text PRIMARY KEY,
    user_id text NOT NULL,
    gig_id text NOT NULL,
    recipient text NOT NULL,
    status text NOT NULL CHECK (status IN ('reserved','sent','failed','unknown')),
    provider_message_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  const rows = await sql.query<{ idempotency_key: string }>(
    `INSERT INTO outreach_delivery_audit (idempotency_key,user_id,gig_id,recipient,status)
     VALUES ($1,$2,$3,$4,'reserved')
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`,
    [input.idempotencyKey,input.userId,input.gigId,input.recipient.trim().toLowerCase()],
  );
  return rows.length === 1;
}
export async function settleOutreachDelivery(input: {
  userId: string; idempotencyKey: string; status: Exclude<SendAuditStatus, "reserved">;
  providerMessageId?: string;
}): Promise<boolean> {
  if (!input.userId || !input.idempotencyKey || !["sent","failed","unknown"].includes(input.status)) throw new Error("Invalid settlement");
  if (input.status === "sent" && !input.providerMessageId) throw new Error("Provider receipt required");
  const sql = await getSql();
  const rows = await sql.query<{ idempotency_key: string }>(
    `UPDATE outreach_delivery_audit SET status=$3,provider_message_id=$4,updated_at=now()
     WHERE idempotency_key=$1 AND user_id=$2 AND status='reserved'
     RETURNING idempotency_key`,
    [input.idempotencyKey,input.userId,input.status,input.providerMessageId ?? null],
  );
  return rows.length === 1;
}
