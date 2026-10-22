import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authMiddleware } from "./auth/middleware";
import { getSql } from "./db";
import { OUTREACH_POLICY_VERSION } from "./outreach-message";
export const scheduledOutreachStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rules = await sql.query<{
      enabled: boolean;
      hourly_limit: number;
      daily_limit: number;
      max_followups: number;
    }>(
      "select enabled,hourly_limit,daily_limit,max_followups from outreach_rules where user_id=$1",
      [context.userId],
    );
    const jobs = await sql.query<{
      id: string;
      status: string;
      not_before: Date;
      result_code: string | null;
      recipient: string;
    }>(
      "select j.id,j.status,j.not_before,j.result_code,a.recipient from outreach_jobs j join outreach_approvals a on a.id=j.approval_id and a.user_id=j.user_id where j.user_id=$1 order by j.created_at desc limit 50",
      [context.userId],
    );
    const replies = await sql.query<{
      message_id: string;
      gig_id: string;
      recipient: string;
      classification: string;
    }>(
      "select message_id,gig_id,recipient,classification from outreach_replies where user_id=$1 order by received_at desc limit 50",
      [context.userId],
    );
    return {
      rules: rules[0] ?? { enabled: false, hourly_limit: 5, daily_limit: 20, max_followups: 2 },
      jobs: jobs.map((j) => ({ ...j, not_before: new Date(j.not_before).toISOString() })),
      replies,
    };
  });
export const configureOutreachRules = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      enabled: z.boolean(),
      consent: z.literal(true),
      hourly: z.number().int().min(1).max(5),
      daily: z.number().int().min(1).max(20),
      followups: z.number().int().min(0).max(2),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx.query("update outreach_dispatch_guard set epoch=epoch+1 where id=1");
      await tx.query(
        "insert into outreach_rules(user_id,enabled,hourly_limit,daily_limit,max_followups,policy_version) values($1,$2,$3,$4,$5,$6) on conflict(user_id) do update set enabled=$2,hourly_limit=$3,daily_limit=$4,max_followups=$5,policy_version=$6,consented_at=now()",
        [
          context.userId,
          data.enabled,
          data.hourly,
          data.daily,
          data.followups,
          OUTREACH_POLICY_VERSION,
        ],
      );
      await tx.query(
        "insert into outreach_rule_events(id,user_id,enabled,hourly_limit,daily_limit,max_followups,policy_version) values($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          context.userId,
          data.enabled,
          data.hourly,
          data.daily,
          data.followups,
          OUTREACH_POLICY_VERSION,
        ],
      );
      if (!data.enabled)
        await tx.query(
          "update outreach_approvals set revoked_at=now() where user_id=$1 and id in(select approval_id from outreach_jobs where user_id=$1 and status='scheduled')",
          [context.userId],
        );
      if (!data.enabled)
        await tx.query(
          "update outreach_jobs set status='cancelled',result_code='opt-out',updated_at=now() where user_id=$1 and status='scheduled'",
          [context.userId],
        );
    });
    return { ok: true };
  });
export const scheduleApprovedOutreach = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().uuid(),
      notBefore: z.string().datetime(),
      parentKey: z.string().max(500).optional(),
      consent: z.literal(true),
    }),
  )
  .handler(async ({ context, data }) => {
    const due = new Date(data.notBefore);
    if (due.getTime() < Date.now() + 60000 || due.getTime() > Date.now() + 30 * 86400000)
      throw new Error("Schedule between one minute and 30 days from now");
    const sql = await getSql();
    return sql.transaction(async (tx) => {
      await tx.query("update outreach_dispatch_guard set epoch=epoch+1 where id=1");
      const rules = await tx.query<{ max_followups: number }>(
        "select max_followups from outreach_rules where user_id=$1 and enabled=true and policy_version=$2",
        [context.userId, OUTREACH_POLICY_VERSION],
      );
      if (!rules.length) throw new Error("Opt in to scheduling first");
      const [approval] = await tx.query<{
        id: string;
        gig_id: string;
        recipient: string;
        subject: string;
      }>(
        "select id,gig_id,recipient,subject from outreach_approvals where id=$1 and user_id=$2 and revoked_at is null and expires_at>now() for update",
        [data.id, context.userId],
      );
      if (!approval) throw new Error("Fresh approval required");
      if (!data.parentKey) {
        const previous = await tx.query(
          "select idempotency_key from outreach_delivery_audit where user_id=$1 and gig_id=$2 and recipient=$3 union all select j.id from outreach_jobs j join outreach_approvals a on a.user_id=j.user_id and a.id=j.approval_id where j.user_id=$1 and a.gig_id=$2 and a.recipient=$3 and j.status<>'cancelled' limit 1",
          [context.userId, approval.gig_id, approval.recipient],
        );
        if (previous.length) throw new Error("Use a confirmed parent receipt for follow-ups");
      }
      let followupNumber = 0;
      if (data.parentKey) {
        const parent = await tx.query<{ created_at: Date; subject: string }>(
          "select d.created_at,a.subject from outreach_delivery_audit d join outreach_approvals a on a.user_id=d.user_id and a.id=d.approval_id where d.idempotency_key=$1 and d.user_id=$2 and d.gig_id=$3 and d.recipient=$4 and d.status='sent' and d.provider_thread_id is not null",
          [data.parentKey, context.userId, approval.gig_id, approval.recipient],
        );
        if (
          !parent.length ||
          due.getTime() < new Date(parent[0].created_at).getTime() + 3 * 86400000
        )
          throw new Error("Follow-ups need a confirmed parent and at least three days spacing");
        if (
          parent[0].subject.replace(/^re:\s*/i, "").trim() !==
          approval.subject.replace(/^re:\s*/i, "").trim()
        )
          throw new Error("Follow-up subject must match the parent thread");
        const [count] = await tx.query<{ n: string }>(
          "select count(*) as n from outreach_jobs j join outreach_approvals a on a.id=j.approval_id and a.user_id=j.user_id where j.user_id=$1 and a.gig_id=$2 and a.recipient=$3 and j.parent_key is not null and j.status<>'cancelled'",
          [context.userId, approval.gig_id, approval.recipient],
        );
        followupNumber = Number(count.n) + 1;
        if (Number(count.n) >= rules[0].max_followups) throw new Error("Follow-up limit reached");
      }
      const id = randomUUID(),
        copy = randomUUID();
      // New time-bound consent record preserves the original review record unchanged.
      await tx.query(
        `insert into outreach_approvals(id,user_id,gig_id,recipient,subject,body,message_fingerprint,contact_source_url,policy_version,expires_at)
 select $3,user_id,gig_id,recipient,subject,body,message_fingerprint,contact_source_url,policy_version,$4 from outreach_approvals where id=$1 and user_id=$2`,
        [data.id, context.userId, copy, new Date(due.getTime() + 86400000)],
      );
      await tx.query("update outreach_approvals set revoked_at=now() where id=$1 and user_id=$2", [
        data.id,
        context.userId,
      ]);
      await tx.query(
        "insert into outreach_jobs(id,user_id,approval_id,parent_key,not_before,followup_number) values($1,$2,$3,$4,$5,$6)",
        [id, context.userId, copy, data.parentKey ?? null, due, followupNumber],
      );
      return { id };
    });
  });
export const cancelScheduledOutreach = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx.query("update outreach_dispatch_guard set epoch=epoch+1 where id=1");
      const [job] = await tx.query<{ approval_id: string }>(
        "select approval_id from outreach_jobs j where id=$1 and user_id=$2 and (status='scheduled' or (status='blocked' and not exists(select 1 from outreach_delivery_audit d where d.user_id=j.user_id and d.approval_id=j.approval_id))) for update",
        [data.id, context.userId],
      );
      if (!job) throw new Error("In-flight or delivered jobs require receipt review");
      await tx.query("update outreach_approvals set revoked_at=now() where id=$1 and user_id=$2", [
        job.approval_id,
        context.userId,
      ]);
      await tx.query(
        "update outreach_jobs set status='cancelled',result_code='user-cancelled',updated_at=now() where id=$1 and user_id=$2",
        [data.id, context.userId],
      );
    });
    return { ok: true };
  });
