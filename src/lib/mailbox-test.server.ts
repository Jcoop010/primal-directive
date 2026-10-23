import type { Sql } from "./db";
import {
  deliverGmail,
  encodeGmailMessage,
  normalizeRecipient,
  outreachInternetMessageId,
} from "./outreach-message";
import type { MailHeader } from "./mailbox-policy";

const SUBJECT = "Primal Directive — Gmail connection test";
const BODY =
  'This is the one-time Gmail sending test you requested from Primal Directive.\n\nNo booking outreach has been enabled.\n\nPlease reply with "Test received" so we can verify reply synchronization.\n\nPrimal Directive';
const POLICY = "mailbox-connection-test-2026-10-23-v1";
type Grant = { id: string; ownerEmail: string; recipient: string; expiresAt: string };
type Attempt = {
  grant_id: string;
  account_id: string;
  recipient: string;
  status: string;
  provider_message_id: string | null;
  reply_message_id: string | null;
  reason: string | null;
};

/** This administrative grant is inert unless it matches the verified signed-in
 * artist. It authorizes one fixed message, not a release of booking outreach. */
export async function configuredMailboxTest(
  sql: Sql,
  userId: string,
  raw = process.env.MAILBOX_TEST_GRANT,
): Promise<Grant | null> {
  try {
    const g = JSON.parse(raw ?? "null") as Grant | null;
    if (!g || !/^[a-f0-9-]{36}$/i.test(g.id) || typeof g.expiresAt !== "string") return null;
    const until = Date.parse(g.expiresAt),
      now = Date.now();
    if (!Number.isFinite(until) || until <= now || until > now + 24 * 3600000) return null;
    const owner = normalizeRecipient(g.ownerEmail),
      recipient = normalizeRecipient(g.recipient);
    const [user] = await sql.query<{ email: string; emailVerified: boolean }>(
      'select email,"emailVerified" from "user" where id=$1',
      [userId],
    );
    if (!user?.emailVerified || user.email.toLowerCase() !== owner) return null;
    return { ...g, ownerEmail: owner, recipient };
  } catch {
    return null;
  }
}
export async function mailboxTestPlan(sql: Sql, userId: string) {
  const grant = await configuredMailboxTest(sql, userId);
  const [latest] = await sql.query<Attempt>(
    "select grant_id,account_id,recipient,status,provider_message_id,reply_message_id,reason from mailbox_connection_tests where user_id=$1 order by approved_at desc limit 1",
    [userId],
  );
  const [used] = grant
    ? await sql.query<{ grant_id: string }>(
        "select grant_id from mailbox_connection_tests where grant_id=$1",
        [grant.id],
      )
    : [];
  return {
    grant:
      grant && !used
        ? {
            id: grant.id,
            recipient: grant.recipient,
            subject: SUBJECT,
            body: BODY,
            expiresAt: grant.expiresAt,
          }
        : null,
    latest: latest ?? null,
  };
}
export async function executeMailboxTest(
  sql: Sql,
  userId: string,
  accountId: string,
  grantId: string,
  tokenFor: () => Promise<{ token: string; account: { providerId: string } }>,
  rawGrant = process.env.MAILBOX_TEST_GRANT,
) {
  const grant = await configuredMailboxTest(sql, userId, rawGrant);
  if (!grant || grant.id !== grantId)
    throw new Error("This one-time test is not authorized for your account or has expired.");
  const { token, account } = await tokenFor();
  if (account.providerId !== "google")
    throw new Error("This test requires your selected Gmail mailbox.");
  // Refresh credentials before reservation; no provider send has occurred yet.
  await sql.transaction(async (tx) => {
    await tx.query("update outreach_dispatch_guard set epoch=epoch+1 where id=1");
    const [owned] = await tx.query<{ id: string }>(
      `select a.id from account a
      join "user" u on u.id=a."userId"
      join mailbox_preferences p on p.user_id=a."userId" and p.account_id=a.id
      join mailbox_connections c on c.user_id=a."userId" and c.account_id=a.id
      where a."userId"=$1 and a.id=$2 and a."providerId"='google'
      and lower(u.email)=$3 and u."emailVerified" and c.enabled and c.last_sync_at is not null and c.last_error is null
      and (a."accessToken" is not null or a."refreshToken" is not null)
      and coalesce(a.scope,'') ~ '(^|[ ,])https://www[.]googleapis[.]com/auth/gmail[.]send($|[ ,])'
      for update of a,c,p`,
      [userId, accountId, grant.ownerEmail],
    );
    if (!owned || Date.parse(grant.expiresAt) <= Date.now())
      throw new Error("Select and verify your Gmail inbox with send permission before this test.");
    const [attempt] = await tx.query<{ grant_id: string }>(
      `insert into mailbox_connection_tests(grant_id,user_id,account_id,recipient,subject,body,policy_version,status)
      values($1,$2,$3,$4,$5,$6,$7,'reserved') on conflict(grant_id) do nothing returning grant_id`,
      [grant.id, userId, accountId, grant.recipient, SUBJECT, BODY, POLICY],
    );
    if (!attempt)
      throw new Error(
        "This test has already been attempted. Do not resend; check its recorded status.",
      );
  });
  const raw = encodeGmailMessage({
    recipient: grant.recipient,
    subject: SUBJECT,
    body: BODY,
    key: `connection-test:${grant.id}`,
  });
  const result = await deliverGmail(token, raw);
  // A reserved/unknown attempt is never retried if persistence or the network fails.
  await sql.query(
    `update mailbox_connection_tests set status=$3,provider_message_id=$4,provider_thread_id=$5,reason=$6,updated_at=now() where grant_id=$1 and user_id=$2 and status='reserved'`,
    [
      grant.id,
      userId,
      result.status,
      result.status === "sent" ? result.messageId : null,
      result.status === "sent" ? (result.threadId ?? null) : null,
      result.status === "sent" ? null : result.reason,
    ],
  );
  return result.status === "sent"
    ? { status: result.status, messageId: result.messageId }
    : { status: result.status, reason: result.reason };
}
export async function recordMailboxTestReplies(
  sql: Sql,
  userId: string,
  accountId: string,
  messages: MailHeader[],
) {
  const tests = await sql.query<{
    grant_id: string;
    recipient: string;
    provider_thread_id: string | null;
    provider_message_id: string | null;
  }>(
    "select grant_id,recipient,provider_thread_id,provider_message_id from mailbox_connection_tests where user_id=$1 and account_id=$2 and status in ('sent','unknown') and reply_message_id is null",
    [userId, accountId],
  );
  for (const attempt of tests) {
    const reply = messages.find((m) => {
      const sender = (m.from.match(/<([^>]+)>/)?.[1] ?? m.from).trim().toLowerCase();
      return (
        sender === attempt.recipient &&
        m.id !== attempt.provider_message_id &&
        (m.replyTo === outreachInternetMessageId(`connection-test:${attempt.grant_id}`) ||
          Boolean(attempt.provider_thread_id && m.threadId === attempt.provider_thread_id))
      );
    });
    if (reply)
      await sql.query(
        "update mailbox_connection_tests set reply_message_id=$4,updated_at=now() where grant_id=$1 and user_id=$2 and account_id=$3 and reply_message_id is null",
        [attempt.grant_id, userId, accountId, reply.id],
      );
  }
}
