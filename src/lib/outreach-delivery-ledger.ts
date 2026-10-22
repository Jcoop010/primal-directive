import { getSql } from "./db";
type SendAuditStatus = "reserved" | "sent" | "failed" | "unknown";

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

/** Audit-backed, fail-closed sending quota. Counts reservations as sends because
 * provider timeouts may have delivered the message. Includes all statuses.
 */
export async function getOutreachSendQuota(userId: string): Promise<{
  hourlyCount: number; dailyCount: number; canSend: boolean;
}> {
  if (!userId) throw new Error("User identity required");
  const sql = await getSql();
  const rows = await sql.query<{ hourly_count: string | number; daily_count: string | number }>(
    `SELECT COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour') AS hourly_count,
            COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS daily_count
     FROM outreach_delivery_audit WHERE user_id = $1`, [userId],
  );
  const hourlyCount = Number(rows[0]?.hourly_count);
  const dailyCount = Number(rows[0]?.daily_count);
  if (!Number.isSafeInteger(hourlyCount) || !Number.isSafeInteger(dailyCount)) throw new Error("Invalid quota audit");
  return { hourlyCount, dailyCount, canSend: hourlyCount < 5 && dailyCount < 20 };
}
