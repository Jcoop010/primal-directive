import { auth } from "./auth/server";
import { getSql } from "./db";
import { requirePaid } from "./billing.server";
import { dispatchApprovedBooking, sendingReleased } from "./outreach-dispatch.server";
import { matchedBookingReplies, type ThreadMessage } from "./outreach-followup-policy";
/** Bounded cron processor. Claimed/ambiguous jobs are never automatically retried. */
export async function runScheduledOutreach() {
  if (!sendingReleased()) return { disabled: true, processed: 0 };
  const sql = await getSql();
  const jobs = await sql.query<{
    id: string;
    user_id: string;
    approval_id: string;
    parent_key: string | null;
    followup_number: number;
  }>(
    "select id,user_id,approval_id,parent_key,followup_number from outreach_jobs where status='scheduled' and not_before<=now() order by not_before limit 5",
  );
  let processed = 0;
  for (const candidate of jobs) {
    const claimed = await sql.query(
      "update outreach_jobs set status='processing',updated_at=now() where id=$1 and user_id=$2 and status='scheduled' returning id",
      [candidate.id, candidate.user_id],
    );
    if (!claimed.length) continue;
    const finish = async (status: string, code: string) => {
      await sql.query(
        "update outreach_jobs set status=$3,result_code=$4,updated_at=now() where id=$1 and user_id=$2 and status='processing'",
        [candidate.id, candidate.user_id, status, code],
      );
    };
    try {
      const allowed = await sql.query(
        "select r.user_id from outreach_rules r join outreach_preferences p on p.user_id=r.user_id where r.user_id=$1 and r.enabled=true and p.paused=false and r.policy_version='2026-10-22-v1' and r.max_followups>=$2",
        [candidate.user_id, candidate.followup_number],
      );
      if (!allowed.length) {
        await finish("blocked", "paused-or-opted-out");
        continue;
      }
      await requirePaid(candidate.user_id, true);
      const accounts = await sql.query<{ scope: string | null }>(
        'select scope from account where "userId"=$1 and "providerId"=\'google\'',
        [candidate.user_id],
      );
      if (
        !accounts.some((a) =>
          (a.scope ?? "").split(/\s+/).includes("https://www.googleapis.com/auth/gmail.readonly"),
        )
      ) {
        await finish("blocked", "gmail-read-consent-required");
        continue;
      }
      let replyContext: { parentKey: string; threadId: string } | undefined;
      if (candidate.parent_key) {
        const [parent] = await sql.query<{
          gig_id: string;
          recipient: string;
          provider_thread_id: string;
          created_at: Date;
        }>(
          "select gig_id,recipient,provider_thread_id,created_at from outreach_delivery_audit where idempotency_key=$1 and user_id=$2 and status='sent' and provider_thread_id is not null",
          [candidate.parent_key, candidate.user_id],
        );
        if (!parent) {
          await finish("blocked", "parent-receipt-missing");
          continue;
        }
        replyContext = { parentKey: candidate.parent_key, threadId: parent.provider_thread_id };
        const token = await auth.api.getAccessToken({
          body: { providerId: "google", userId: candidate.user_id },
        });
        if (!token?.accessToken) {
          await finish("blocked", "gmail-reconnect-required");
          continue;
        }
        const response = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(parent.provider_thread_id)}?format=full`,
          {
            headers: { Authorization: `Bearer ${token.accessToken}` },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!response.ok) {
          await finish("blocked", `reply-inspection-${response.status}`);
          continue;
        }
        // Bound provider bytes before parsing to avoid unexpectedly large mail threads.
        const reader = response.body?.getReader();
        if (!reader) {
          await finish("blocked", "reply-inspection-empty");
          continue;
        }
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.length;
            if (bytes > 1000000) {
              await reader.cancel();
              throw new Error("Thread too large");
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const thread = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          messages?: ThreadMessage[];
        };
        if (
          !Array.isArray(thread.messages) ||
          !thread.messages.length ||
          !thread.messages.every(
            (m) => typeof m.id === "string" && m.threadId === parent.provider_thread_id,
          )
        ) {
          await finish("blocked", "reply-inspection-invalid");
          continue;
        }
        const anyInbound = thread.messages.some(
          (m) =>
            m.labelIds?.includes("INBOX") &&
            !m.labelIds.includes("SENT") &&
            Number(m.internalDate) > new Date(parent.created_at).getTime(),
        );
        const replies = matchedBookingReplies(thread.messages, {
          recipient: parent.recipient,
          threadId: parent.provider_thread_id,
          sentAt: new Date(parent.created_at).getTime(),
        });
        for (const reply of replies) {
          await sql.query(
            "insert into outreach_replies(user_id,message_id,thread_id,gig_id,recipient,classification) values($1,$2,$3,$4,$5,$6) on conflict do nothing",
            [
              candidate.user_id,
              reply.messageId,
              parent.provider_thread_id,
              parent.gig_id,
              parent.recipient,
              reply.classification,
            ],
          );
          if (reply.classification === "opt_out")
            await sql.query(
              "insert into outreach_suppressions(user_id,recipient,reason) values($1,$2,'Gmail reply opt-out') on conflict do nothing",
              [candidate.user_id, parent.recipient],
            );
        }
        if (replies.length || anyInbound) {
          await finish("cancelled", "inbound-reply-detected");
          continue;
        }
      }
      if (!candidate.parent_key) {
        const previous = await sql.query(
          "select d.idempotency_key from outreach_delivery_audit d join outreach_approvals a on a.user_id=d.user_id and a.gig_id=d.gig_id and a.recipient=d.recipient where a.id=$1 and a.user_id=$2 limit 1",
          [candidate.approval_id, candidate.user_id],
        );
        if (previous.length) {
          await finish("blocked", "initial-message-already-attempted");
          continue;
        }
      }
      const result = await dispatchApprovedBooking(
        candidate.user_id,
        candidate.approval_id,
        undefined,
        replyContext,
      );
      await finish(
        result.status === "sent" ? "sent" : result.status === "unknown" ? "unknown" : "blocked",
        result.status === "sent" ? "provider-receipt-recorded" : result.reason,
      );
      processed++;
    } catch {
      const audit = await sql.query<{ status: string }>(
        "select status from outreach_delivery_audit where user_id=$1 and approval_id=$2",
        [candidate.user_id, candidate.approval_id],
      );
      await finish(
        audit.length ? "unknown" : "blocked",
        audit.length ? "delivery-review-required" : "authorization-or-provider-check-failed",
      );
    }
  }
  return { disabled: false, processed };
}
