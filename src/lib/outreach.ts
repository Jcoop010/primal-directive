import { createServerFn } from "@tanstack/react-start";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authMiddleware } from "./auth/middleware";
import { mailboxToken, ownedMailbox } from "./mailbox-provider.server";
import { getSql } from "./db";
import { requirePaid } from "./billing.server";
import {
  deliverGmail,
  deliverOutlook,
  encodeGmailMessage,
  messageFingerprint,
  normalizeRecipient,
  OUTREACH_POLICY_VERSION,
} from "./outreach-message";
import { reserveOutreachDelivery, settleOutreachDelivery } from "./outreach-delivery-ledger";

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
      mail_provider: string;
      created_at: Date;
    }>(
      "select idempotency_key,gig_id,recipient,status,provider_message_id,mail_provider,created_at from outreach_delivery_audit where user_id=$1 order by created_at desc limit 50",
      [context.userId],
    );
    const approvals = await sql.query<{
      id: string;
      gig_id: string;
      recipient: string;
      subject: string;
      body: string;
      approved_at: Date;
      mail_provider: string;
    }>(
      'select id,gig_id,recipient,subject,body,approved_at,coalesce((select m."providerId" from account m where m.id=a.mailbox_account_id and m."userId"=a.user_id),\'google\') as mail_provider from outreach_approvals a where user_id=$1 and revoked_at is null and expires_at>now() and not exists(select 1 from outreach_delivery_audit d where d.user_id=a.user_id and d.approval_id=a.id) order by approved_at desc limit 50',
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
    await sql.query(
      "insert into outreach_preferences(user_id,paused) values($1,$2) on conflict(user_id) do update set paused=$2,updated_at=now()",
      [context.userId, data.paused],
    );
    // Emergency pause also revokes unsent approvals. Resuming requires a fresh review.
    if (data.paused)
      await sql.query(
        "update outreach_approvals set revoked_at=now() where user_id=$1 and revoked_at is null",
        [context.userId],
      );
    return { paused: data.paused };
  });
export const suppressOutreachContact = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ recipient: z.string(), reason: z.string().min(1).max(200) }))
  .handler(async ({ context, data }) => {
    const recipient = normalizeRecipient(data.recipient);
    const sql = await getSql();
    await sql.query(
      "insert into outreach_suppressions(user_id,recipient,reason) values($1,$2,$3) on conflict(user_id,recipient) do nothing",
      [context.userId, recipient, data.reason],
    );
    await sql.query(
      "update outreach_approvals set revoked_at=now() where user_id=$1 and recipient=$2 and revoked_at is null",
      [context.userId, recipient],
    );
    return { ok: true };
  });
export const approveBookingMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      gigId: z.string().min(1).max(200),
      mailboxAccountId: z.string().min(1).max(200).optional(),
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
    const [preference] = await sql.query<{ account_id: string | null }>(
      "select account_id from mailbox_preferences where user_id=$1",
      [context.userId],
    );
    const mailboxAccountId = data.mailboxAccountId ?? preference?.account_id ?? null;
    if (mailboxAccountId) await ownedMailbox(context.userId, mailboxAccountId);
    await sql.query(
      `insert into outreach_approvals(id,user_id,gig_id,recipient,subject,body,message_fingerprint,contact_source_url,policy_version,mailbox_account_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
        mailboxAccountId,
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
      throw new Error(
        "Sending remains disabled pending provider test-account verification and owner authorization",
      );
    await requirePaid(context.userId);
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      gig_id: string;
      recipient: string;
      subject: string;
      body: string;
      message_fingerprint: string;
      mailbox_account_id: string | null;
    }>(
      "select id,gig_id,recipient,subject,body,message_fingerprint,mailbox_account_id from outreach_approvals where id=$1 and user_id=$2 and revoked_at is null and expires_at>now()",
      [data.id, context.userId],
    );
    const approval = rows[0];
    if (!approval) throw new Error("Approval expired, revoked or unavailable");
    let accountId = approval.mailbox_account_id;
    if (!accountId) {
      // Legacy approvals were Google-only. Never silently reroute them to Outlook.
      const [legacy] = await sql.query<{ id: string }>(
        'select id from account where "userId"=$1 and "providerId"=\'google\'',
        [context.userId],
      );
      if (!legacy)
        throw new Error("Connect Gmail or create a fresh approval for your selected mailbox.");
      accountId = legacy.id;
      await sql.query(
        "update outreach_approvals set mailbox_account_id=$3 where id=$1 and user_id=$2 and mailbox_account_id is null",
        [approval.id, context.userId, accountId],
      );
    }
    const { account, token } = await mailboxToken(context.userId, accountId, "send");
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
    const delivery =
      account.providerId === "microsoft"
        ? await deliverOutlook(token, {
            recipient: approval.recipient,
            subject: approval.subject,
            body: approval.body,
            key,
          })
        : await deliverGmail(token, raw);
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
