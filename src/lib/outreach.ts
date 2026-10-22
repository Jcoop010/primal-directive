import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authMiddleware } from "./auth/middleware";
import { auth } from "./auth/server";
import { getSql } from "./db";
import { requirePaid } from "./billing.server";
import {
  deliverGmail,
  encodeGmailMessage,
  messageFingerprint,
  normalizeRecipient,
  OUTREACH_POLICY_VERSION,
} from "./outreach-message";
import { reserveOutreachDelivery, settleOutreachDelivery } from "./outreach-delivery-ledger";
const SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export function sendingReleased() {
  return (
    process.env.OUTREACH_SEND_ENABLED === "true" && process.env.OUTREACH_RELEASE_VERIFIED === "true"
  );
}
export const outreachStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const preferences = await sql.query<{ paused: boolean }>(
      "select paused from outreach_preferences where user_id=$1",
      [context.userId],
    );
    const activity = await sql.query<{
      idempotency_key: string;
      gig_id: string;
      recipient: string;
      status: string;
      provider_message_id: string | null;
      created_at: Date;
    }>(
      "select idempotency_key,gig_id,recipient,status,provider_message_id,created_at from outreach_delivery_audit where user_id=$1 order by created_at desc limit 50",
      [context.userId],
    );
    const approvals = await sql.query<{
      id: string;
      gig_id: string;
      recipient: string;
      subject: string;
      body: string;
      approved_at: Date;
    }>(
      "select id,gig_id,recipient,subject,body,approved_at from outreach_approvals a where user_id=$1 and revoked_at is null and expires_at>now() and not exists(select 1 from outreach_delivery_audit d where d.user_id=a.user_id and d.approval_id=a.id) order by approved_at desc limit 50",
      [context.userId],
    );
    return {
      released: sendingReleased(),
      paused: preferences[0]?.paused ?? true,
      activity: activity.map((a) => ({ ...a, created_at: new Date(a.created_at).toISOString() })),
      approvals: approvals.map((a) => ({
        ...a,
        approved_at: new Date(a.approved_at).toISOString(),
      })),
    };
  });
export const pauseOutreach = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ paused: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      // Serialize emergency pause with delivery reservations.
      await tx.query("select epoch from outreach_dispatch_guard where id=1 for update");
      await tx.query(
        "insert into outreach_preferences(user_id,paused) values($1,$2) on conflict(user_id) do update set paused=$2,updated_at=now()",
        [context.userId, data.paused],
      );
      if (data.paused)
        await tx.query(
          "update outreach_approvals set revoked_at=now() where user_id=$1 and revoked_at is null",
          [context.userId],
        );
    });
    return { paused: data.paused };
  });
export const suppressOutreachContact = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ recipient: z.string(), reason: z.string().min(1).max(200) }))
  .handler(async ({ context, data }) => {
    const recipient = normalizeRecipient(data.recipient);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      // Match the dispatcher's guard so suppression and approval revocation are atomic.
      await tx.query("select epoch from outreach_dispatch_guard where id=1 for update");
      await tx.query(
        "insert into outreach_suppressions(user_id,recipient,reason) values($1,$2,$3) on conflict(user_id,recipient) do nothing",
        [context.userId, recipient, data.reason],
      );
      await tx.query(
        "update outreach_approvals set revoked_at=now() where user_id=$1 and recipient=$2 and revoked_at is null",
        [context.userId, recipient],
      );
    });
    return { ok: true };
  });
export const approveBookingMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      gigId: z.string().min(1).max(200),
      recipient: z.string().max(254),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(30000),
      verifiedContact: z.literal(true),
      consent: z.literal(true),
      contactSourceUrl: z.string().url().startsWith("https://").max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ state: { gigs?: { id: string }[] } }>(
      "select state from app_state where user_id=$1",
      [context.userId],
    );
    if (!rows[0]?.state.gigs?.some((g) => g.id === data.gigId))
      throw new Error("Save this booking before approving outreach");
    const id = randomUUID(),
      recipient = normalizeRecipient(data.recipient);
    const fingerprint = messageFingerprint(recipient, data.subject, data.body);
    encodeGmailMessage({ recipient, subject: data.subject, body: data.body, key: id });
    await sql.query(
      `insert into outreach_approvals(id,user_id,gig_id,recipient,subject,body,message_fingerprint,contact_source_url,policy_version)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        context.userId,
        data.gigId,
        recipient,
        data.subject,
        data.body,
        fingerprint,
        data.contactSourceUrl,
        OUTREACH_POLICY_VERSION,
      ],
    );
    return { id };
  });
export const revokeBookingApproval = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      "update outreach_approvals set revoked_at=now() where id=$1 and user_id=$2 and revoked_at is null",
      [data.id, context.userId],
    );
    return { ok: true };
  });
export const sendApprovedBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!sendingReleased())
      throw new Error("Sending remains disabled pending Gmail test-account verification");
    await requirePaid(context.userId);
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
      [data.id, context.userId],
    );
    const approval = rows[0];
    if (!approval) throw new Error("Approval expired, revoked or unavailable");
    const accounts = await sql.query<{ scope: string | null }>(
      'select scope from account where "userId"=$1 and "providerId"=\'google\'',
      [context.userId],
    );
    if (!accounts.some((a) => (a.scope ?? "").split(/\s+/).includes(SEND_SCOPE)))
      throw new Error("Reconnect Gmail with send permission");
    const request = getRequest();
    if (!request) throw new Error("Session required");
    // Better Auth refreshes/decrypts this account's token; never return it to the browser.
    let token;
    try {
      token = await auth.api.getAccessToken({
        body: { providerId: "google" },
        headers: request.headers,
      });
    } catch {
      throw new Error("Gmail authorization expired or revoked. Reconnect Gmail.");
    }
    if (!token?.accessToken) throw new Error("Reconnect Gmail");
    const key = `${context.userId}:${approval.id}`;
    const raw = encodeGmailMessage({
      recipient: approval.recipient,
      subject: approval.subject,
      body: approval.body,
      key,
    });
    if (
      !(await reserveOutreachDelivery({
        userId: context.userId,
        gigId: approval.gig_id,
        recipient: approval.recipient,
        idempotencyKey: key,
        approvalId: approval.id,
        messageFingerprint: approval.message_fingerprint,
      }))
    )
      throw new Error(
        "Send blocked: paused, suppressed, duplicate, expired approval or quota limit",
      );
    const delivery = await deliverGmail(token.accessToken, raw);
    const persisted = await settleOutreachDelivery({
      userId: context.userId,
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
  });
