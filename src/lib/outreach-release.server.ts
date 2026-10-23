import type { Sql } from "./db";

/** A short-lived release probe is bound to one immutable approval. It never
 * opens general sending or bypasses consent, mailbox checks, quota or the ledger. */
export async function verificationApprovalId(sql: Sql, userId: string): Promise<string | null> {
  try {
    const g = JSON.parse(process.env.OUTREACH_VERIFICATION_GRANT ?? "null") as {
      approvalId?: string;
      ownerEmail?: string;
      recipient?: string;
      mailboxAccountId?: string;
      messageFingerprint?: string;
      expiresAt?: string;
    } | null;
    if (
      !g ||
      !/^[a-f0-9-]{36}$/i.test(g.approvalId ?? "") ||
      typeof g.ownerEmail !== "string" ||
      typeof g.recipient !== "string" ||
      typeof g.mailboxAccountId !== "string" ||
      !/^[a-f0-9]{64}$/.test(g.messageFingerprint ?? "")
    )
      return null;
    const expiry = Date.parse(g.expiresAt ?? "");
    if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 86400000)
      return null;
    const [row] = await sql.query<{ id: string }>(
      `select a.id from outreach_approvals a join "user" u on u.id=a.user_id
      where a.id=$1 and a.user_id=$2 and lower(u.email)=$3 and u."emailVerified"=true
      and a.recipient=$4 and a.message_fingerprint=$5 and a.mailbox_account_id=$6
      and a.revoked_at is null and a.expires_at>now()
      and not exists(select 1 from outreach_delivery_audit d where d.user_id=a.user_id and d.approval_id=a.id)`,
      [
        g.approvalId,
        userId,
        g.ownerEmail.trim().toLowerCase(),
        g.recipient.trim().toLowerCase(),
        g.messageFingerprint,
        g.mailboxAccountId,
      ],
    );
    return row?.id ?? null;
  } catch {
    return null;
  }
}
