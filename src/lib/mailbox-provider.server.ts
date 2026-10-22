import { randomUUID } from "node:crypto";
import { outreachInternetMessageId } from "./outreach-message";
import { auth } from "./auth/server";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "./db";
import {
  hasMailScope,
  parseMailScopes,
  mailboxError,
  graphHeaders,
  type MailProvider,
  type MailHeader,
} from "./mailbox-policy";
export type OwnedMailbox = {
  id: string;
  accountId: string;
  providerId: MailProvider;
  scope: string | null;
  enabled: boolean;
};
export async function ownedMailbox(userId: string, id: string): Promise<OwnedMailbox> {
  const sql = await getSql();
  const [account] = await sql.query<OwnedMailbox>(
    `select a.id,a."accountId",a."providerId",a.scope,coalesce(c.enabled,true) as enabled
    from account a left join mailbox_connections c on c.user_id=a."userId" and c.account_id=a.id
    where a."userId"=$1 and a.id=$2 and a."providerId" in ('google','microsoft')`,
    [userId, id],
  );
  if (!account || !account.enabled)
    throw new Error("Mailbox unavailable. Connect it from your account.");
  return account;
}
export async function mailboxToken(
  userId: string,
  id: string,
  purpose: "read" | "send" | "drafts",
) {
  const account = await ownedMailbox(userId, id);
  if (!hasMailScope(account.providerId, parseMailScopes(account.scope), purpose))
    throw new Error(`Mailbox ${purpose} permission is missing. Reconnect with this permission.`);
  const request = getRequest();
  if (!request) throw new Error("Session required");
  try {
    const token = await auth.api.getAccessToken({
      body: { providerId: account.providerId, accountId: account.accountId },
      headers: request.headers,
    });
    if (!token?.accessToken) throw new Error();
    return { account, token: token.accessToken };
  } catch {
    throw new Error("Authorization expired or was revoked. Reconnect this mailbox.");
  }
}
/** Provider errors are never forwarded, since they can contain confidential request details. */
export async function mailboxFetch(token: string, url: string, init: RequestInit = {}) {
  const result = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!result.ok) throw new Error(mailboxError(result.status));
  const raw = await result.text();
  if (raw.length > 1_000_000) throw new Error("Mailbox response exceeded the safe preview limit.");
  return raw ? JSON.parse(raw) : null;
}
export async function readMailboxHeaders(
  token: string,
  provider: MailProvider,
): Promise<MailHeader[]> {
  if (provider === "microsoft")
    return graphHeaders(
      await mailboxFetch(
        token,
        "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=10&$select=id,conversationId,from,subject,receivedDateTime,internetMessageHeaders&$orderby=receivedDateTime%20desc",
      ),
    );
  const list = await mailboxFetch(
    token,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=in%3Ainbox",
  );
  if (list.messages !== undefined && !Array.isArray(list.messages))
    throw new Error("Invalid inbox response");
  const ids: string[] = (list.messages ?? [])
    .map((m: { id?: string }) => m.id)
    .filter((id: unknown) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id))
    .slice(0, 10);
  return Promise.all(
    ids.map(async (id) => {
      const m = await mailboxFetch(
        token,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=In-Reply-To`,
      );
      const header = (name: string, max = 320): string =>
        String(
          (m.payload?.headers ?? []).find(
            (h: { name?: string }) => h.name?.toLowerCase() === name.toLowerCase(),
          )?.value ?? "",
        ).slice(0, max);
      if (typeof m.threadId !== "string") throw new Error("Invalid message thread");
      return {
        id,
        threadId: m.threadId,
        from: header("From"),
        subject: header("Subject"),
        date: header("Date", 128),
        replyTo: header("In-Reply-To", 1024),
      };
    }),
  );
}

export async function rateMailboxAction(userId: string, accountId: string, action: string) {
  const sql = await getSql();
  // Serialize per artist for durable, multi-instance API throttling.
  await sql.transaction(async (tx) => {
    await tx.query("insert into mailbox_preferences(user_id) values($1) on conflict do nothing", [
      userId,
    ]);
    await tx.query("select user_id from mailbox_preferences where user_id=$1 for update", [userId]);
    const [count] = await tx.query<{ n: number }>(
      "select count(*)::int n from mailbox_events where user_id=$1 and created_at>now()-interval '1 minute'",
      [userId],
    );
    if (count.n >= 10 && action !== "disconnected")
      throw new Error("Too many mailbox actions. Wait a minute before trying again.");
    await tx.query("insert into mailbox_events(id,user_id,account_id,action) values($1,$2,$3,$4)", [
      randomUUID(),
      userId,
      accountId,
      action,
    ]);
  });
}

/** Read-only reconciliation: Sent Items proves provider submission, never recipient
 * delivery. Missing/ambiguous receipts retain unknown state and never cause a send. */
export async function reconcileMailboxSubmissions(
  userId: string,
  account: OwnedMailbox,
  token: string,
) {
  const sql = await getSql();
  const attempts = await sql.query<{ idempotency_key: string }>(
    "select idempotency_key from outreach_delivery_audit where user_id=$1 and mailbox_account_id=$2 and status in ('unknown','reserved') order by created_at desc limit 5",
    [userId, account.id],
  );
  const receipts = await Promise.all(
    attempts.map(async (attempt) => {
      const internetId = outreachInternetMessageId(attempt.idempotency_key);
      try {
        if (account.providerId === "microsoft") {
          const params = new URLSearchParams({
            $filter: `internetMessageId eq '${internetId}'`,
            $select: "id,conversationId,internetMessageId",
            $top: "2",
          });
          const result = await mailboxFetch(
            token,
            `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?${params}`,
          );
          if (!Array.isArray(result?.value) || result.value.length !== 1) return null;
          const m = result.value[0];
          if (
            m.internetMessageId !== internetId ||
            typeof m.id !== "string" ||
            typeof m.conversationId !== "string"
          )
            return null;
          return { key: attempt.idempotency_key, id: m.id, thread: m.conversationId };
        }
        const params = new URLSearchParams({
          q: `in:sent rfc822msgid:${internetId}`,
          maxResults: "2",
        });
        const list = await mailboxFetch(
          token,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        );
        if (
          !Array.isArray(list?.messages) ||
          list.messages.length !== 1 ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(list.messages[0]?.id ?? "")
        )
          return null;
        const m = await mailboxFetch(
          token,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${list.messages[0].id}?format=metadata&metadataHeaders=Message-ID`,
        );
        if (
          typeof m.id !== "string" ||
          typeof m.threadId !== "string" ||
          !Array.isArray(m.payload?.headers) ||
          !m.payload.headers.some(
            (h: { name?: string; value?: string }) =>
              h.name?.toLowerCase() === "message-id" && h.value === internetId,
          )
        )
          return null;
        return { key: attempt.idempotency_key, id: m.id, thread: m.threadId };
      } catch {
        return null;
      }
    }),
  );
  for (const receipt of receipts)
    if (receipt)
      await sql.query(
        "update outreach_delivery_audit set status='sent',provider_message_id=$4,provider_thread_id=$5,updated_at=now() where user_id=$1 and mailbox_account_id=$2 and idempotency_key=$3 and status in ('unknown','reserved')",
        [userId, account.id, receipt.key, receipt.id, receipt.thread],
      );
}
