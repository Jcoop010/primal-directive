import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authMiddleware } from "./auth/middleware";
import { getSql } from "./db";
import {
  encodeGmailMessage,
  messageFingerprint,
  normalizeRecipient,
  OUTREACH_POLICY_VERSION,
} from "./outreach-message";
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
      "select id,gig_id,recipient,subject,body,approved_at from outreach_approvals a where user_id=$1 and revoked_at is null and expires_at>now() and not exists(select 1 from outreach_delivery_audit d where d.user_id=a.user_id and d.approval_id=a.id) and not exists(select 1 from outreach_jobs j where j.user_id=a.user_id and j.approval_id=a.id) order by approved_at desc limit 50",
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
    if (data.paused)
      await sql.query(
        "update outreach_jobs set status='cancelled',result_code='account-paused',updated_at=now() where user_id=$1 and status='scheduled'",
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
    const request = getRequest();
    if (!request) throw new Error("Session required");
    const { dispatchApprovedBooking } = await import("./outreach-dispatch.server");
    return dispatchApprovedBooking(context.userId, data.id, request.headers);
  });
