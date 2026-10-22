import { auth } from "./auth/server";
import { getSql } from "./db";
import { requirePaid } from "./billing.server";
import { deliverGmail, encodeGmailMessage } from "./outreach-message";
import { reserveOutreachDelivery, settleOutreachDelivery } from "./outreach-delivery-ledger";
const SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export function sendingReleased() {
  return (
    process.env.OUTREACH_SEND_ENABLED === "true" && process.env.OUTREACH_RELEASE_VERIFIED === "true"
  );
}
/** Server-only: background calls derive userId from a previously authenticated, persisted job. */
export async function dispatchApprovedBooking(
  userId: string,
  approvalId: string,
  headers?: Headers,
  reply?: { parentKey: string; threadId: string },
) {
  if (!sendingReleased())
    throw new Error("Sending remains disabled pending Gmail test-account verification");
  await requirePaid(userId);
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    gig_id: string;
    recipient: string;
    subject: string;
    body: string;
    message_fingerprint: string;
  }>(
    "select id,gig_id,recipient,subject,body,message_fingerprint from outreach_approvals where id=$1 and user_id=$2 and revoked_at is null and expires_at>now()",
    [approvalId, userId],
  );
  const approval = rows[0];
  if (!approval) throw new Error("Approval expired, revoked or unavailable");
  const [workspace] = await sql.query<{ state: { gigs?: { id: string; status: string }[] } }>(
    "select state from app_state where user_id=$1",
    [userId],
  );
  const gig = workspace?.state.gigs?.find((g) => g.id === approval.gig_id);
  if (
    !gig ||
    ["booked", "completed", "declined", "lost", "canceled", "archived", "passed"].includes(
      gig.status,
    )
  )
    throw new Error("Booking is closed or no longer available for outreach");
  const accounts = await sql.query<{ scope: string | null }>(
    'select scope from account where "userId"=$1 and "providerId"=\'google\'',
    [userId],
  );
  if (!accounts.some((a) => (a.scope ?? "").split(/\s+/).includes(SEND_SCOPE)))
    throw new Error("Reconnect Gmail with send permission");
  // Better Auth refreshes/decrypts this account's token; never return it to the browser.
  let token;
  try {
    token = await auth.api.getAccessToken({
      body: { providerId: "google", ...(headers ? {} : { userId }) },
      ...(headers ? { headers } : {}),
    });
  } catch {
    throw new Error("Gmail authorization expired or revoked. Reconnect Gmail.");
  }
  if (!token?.accessToken) throw new Error("Reconnect Gmail");
  const key = `${userId}:${approval.id}`;
  const raw = encodeGmailMessage({
    recipient: approval.recipient,
    subject: approval.subject,
    body: approval.body,
    key,
    ...(reply ? { replyToKey: reply.parentKey } : {}),
  });
  if (
    !(await reserveOutreachDelivery({
      userId: userId,
      gigId: approval.gig_id,
      recipient: approval.recipient,
      idempotencyKey: key,
      approvalId: approval.id,
      messageFingerprint: approval.message_fingerprint,
    }))
  )
    throw new Error("Send blocked: paused, suppressed, duplicate, expired approval or quota limit");
  const delivery = await deliverGmail(token.accessToken, raw, fetch, reply?.threadId);
  const persisted = await settleOutreachDelivery({
    userId: userId,
    idempotencyKey: key,
    status: delivery.status,
    ...(delivery.status === "sent"
      ? { providerMessageId: delivery.messageId, providerThreadId: delivery.threadId }
      : {}),
  });
  if (!persisted) throw new Error("Delivery reconciliation required. Do not retry.");
  return delivery.status === "sent"
    ? { status: delivery.status, messageId: delivery.messageId }
    : { status: delivery.status, reason: delivery.reason };
}
