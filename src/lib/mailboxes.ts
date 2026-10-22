import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authMiddleware } from "./auth/middleware";
import { getSql } from "./db";
import { hasMailScope, parseMailScopes, type MailProvider } from "./mailbox-policy";
import {
  rateMailboxAction as event,
  mailboxToken,
  ownedMailbox,
  mailboxFetch,
  readMailboxHeaders,
  reconcileMailboxSubmissions,
} from "./mailbox-provider.server";
import { normalizeRecipient, encodeGmailMessage } from "./outreach-message";
const accountInput = z.object({ accountId: z.string().min(1).max(200) });
export const mailboxStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const accounts = await sql.query<{
      id: string;
      providerId: MailProvider;
      scope: string | null;
      refreshable: boolean;
      expires: Date | null;
      enabled: boolean;
      last_sync_at: Date | null;
      last_error: string | null;
    }>(
      `select a.id,a."providerId",a.scope,(a."refreshToken" is not null) refreshable,a."accessTokenExpiresAt" expires,
    coalesce(c.enabled,true) enabled,c.last_sync_at,c.last_error from account a left join mailbox_connections c on c.user_id=a."userId" and c.account_id=a.id
    where a."userId"=$1 and a."providerId" in ('google','microsoft')`,
      [context.userId],
    );
    const [prefs] = await sql.query<{ account_id: string | null }>(
      "select account_id from mailbox_preferences where user_id=$1",
      [context.userId],
    );
    const drafts = await sql.query<{
      id: string;
      account_id: string;
      gig_id: string;
      recipient: string;
      subject: string;
      body: string;
      export_status: string;
    }>(
      "select id,account_id,gig_id,recipient,subject,body,export_status from mailbox_drafts where user_id=$1 order by created_at desc limit 20",
      [context.userId],
    );
    const messages = await sql.query<{
      account_id: string;
      message_id: string;
      thread_id: string;
      sender: string;
      subject: string;
      received_at: string;
      reply_to: string | null;
      gig_id: string | null;
    }>(
      "select account_id,message_id,thread_id,sender,subject,received_at,reply_to,gig_id from mailbox_messages where user_id=$1 order by synced_at desc limit 30",
      [context.userId],
    );
    const events = await sql.query<{ action: string; created_at: Date }>(
      "select action,created_at from mailbox_events where user_id=$1 order by created_at desc limit 10",
      [context.userId],
    );
    const [state] = await sql.query<{
      state: { gigs?: { id: string; venue: string; title: string }[] };
    }>("select state from app_state where user_id=$1", [context.userId]);
    return {
      microsoftConfigured: Boolean(
        process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
      ),
      selected: prefs?.account_id ?? null,
      events: events.map((e) => ({ action: e.action, at: new Date(e.created_at).toISOString() })),
      accounts: accounts.map((a) => ({
        ...a,
        scope: undefined,
        scopes: parseMailScopes(a.scope),
        read: hasMailScope(a.providerId, parseMailScopes(a.scope), "read"),
        send: hasMailScope(a.providerId, parseMailScopes(a.scope), "send"),
        drafts: hasMailScope(a.providerId, parseMailScopes(a.scope), "drafts"),
        expires: a.expires ? new Date(a.expires).toISOString() : null,
        last_sync_at: a.last_sync_at ? new Date(a.last_sync_at).toISOString() : null,
      })),
      drafts,
      messages,
      gigs: state?.state.gigs?.map((g) => ({ id: g.id, label: g.title || g.venue || g.id })) ?? [],
    };
  });
export const enableMailbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ provider: z.enum(["google", "microsoft"]) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await event(context.userId, data.provider, "consent-started");
    await sql.query(
      `update mailbox_connections set enabled=true,last_error=null where user_id=$1 and account_id in(select id from account where "userId"=$1 and "providerId"=$2)`,
      [context.userId, data.provider],
    );
    return { ok: true };
  });
export const selectMailbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(accountInput)
  .handler(async ({ context, data }) => {
    const account = await ownedMailbox(context.userId, data.accountId);
    if (!hasMailScope(account.providerId, parseMailScopes(account.scope), "read"))
      throw new Error("Connect inbox permissions first.");
    await event(context.userId, data.accountId, "selected");
    const sql = await getSql();
    await sql.query(
      "insert into mailbox_preferences(user_id,account_id) values($1,$2) on conflict(user_id) do update set account_id=$2,updated_at=now()",
      [context.userId, data.accountId],
    );
    return { ok: true };
  });
export const disconnectMailbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(accountInput)
  .handler(async ({ context, data }) => {
    await ownedMailbox(context.userId, data.accountId);
    await event(context.userId, data.accountId, "disconnected");
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      // Lock same dispatch guard as send reservation. Existing provider submission cannot be undone.
      await tx.query("update outreach_dispatch_guard set epoch=epoch+1 where id=1");
      await tx.query(
        "insert into mailbox_connections(user_id,account_id,enabled) values($1,$2,false) on conflict(user_id,account_id) do update set enabled=false,last_error=null",
        [context.userId, data.accountId],
      );
      await tx.query(
        `update account set "accessToken"=null,"refreshToken"=null,"idToken"=null,scope=null where "userId"=$1 and id=$2`,
        [context.userId, data.accountId],
      );
      await tx.query(
        "update mailbox_preferences set account_id=null where user_id=$1 and account_id=$2",
        [context.userId, data.accountId],
      );
      await tx.query(
        "update outreach_approvals set revoked_at=now() where user_id=$1 and revoked_at is null",
        [context.userId],
      );
      await tx.query(
        "insert into outreach_preferences(user_id,paused) values($1,true) on conflict(user_id) do update set paused=true",
        [context.userId],
      );
    });
    return { ok: true };
  });
export const syncMailbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(accountInput)
  .handler(async ({ context, data }) => {
    await ownedMailbox(context.userId, data.accountId);
    await event(context.userId, data.accountId, "sync-started");
    const sql = await getSql();
    try {
      const { account, token } = await mailboxToken(context.userId, data.accountId, "read");
      await reconcileMailboxSubmissions(context.userId, account, token);
      const messages = await readMailboxHeaders(token, account.providerId);
      await sql.transaction(async (tx) => {
        // A reply cancels unsent approvals; it never automatically confirms a booking.
        await tx.query("update outreach_dispatch_guard set epoch=epoch+1 where id=1");
        for (const m of messages) {
          const [match] = await tx.query<{ gig_id: string; recipient: string }>(
            `select gig_id,recipient from outreach_delivery_audit where user_id=$1 and mailbox_account_id=$2 and provider_thread_id=$3 and status in ('sent','unknown') order by created_at desc limit 1`,
            [context.userId, data.accountId, m.threadId],
          );
          const sender = m.from.match(/<([^>]+)>/)?.[1] ?? m.from;
          // Never match arbitrary email headers to another contact's booking.
          const gig =
            match && sender.toLowerCase() === match.recipient.toLowerCase() ? match.gig_id : null;
          await tx.query(
            `insert into mailbox_messages(user_id,account_id,message_id,thread_id,sender,subject,received_at,reply_to,gig_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(user_id,account_id,message_id) do update set synced_at=now(),gig_id=$9`,
            [
              context.userId,
              data.accountId,
              m.id,
              m.threadId,
              m.from,
              m.subject,
              m.date,
              m.replyTo || null,
              gig,
            ],
          );
          if (gig)
            await tx.query(
              "update outreach_approvals set revoked_at=now() where user_id=$1 and gig_id=$2 and recipient=$3 and revoked_at is null",
              [context.userId, gig, match.recipient],
            );
        }
        await tx.query(
          "insert into mailbox_connections(user_id,account_id,last_sync_at) values($1,$2,now()) on conflict(user_id,account_id) do update set last_sync_at=now(),last_error=null",
          [context.userId, data.accountId],
        );
      });
      return { ok: true, count: messages.length };
    } catch (e) {
      const message =
        e instanceof Error &&
        /^(Authorization|Mailbox|Provider rate|The email provider)/.test(e.message)
          ? e.message
          : "Inbox synchronization failed. Reconnect or try again later.";
      await sql.query(
        "insert into mailbox_connections(user_id,account_id,last_error) values($1,$2,$3) on conflict(user_id,account_id) do update set last_error=$3",
        [context.userId, data.accountId, message],
      );
      throw new Error(message);
    }
  });
export const saveMailboxDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    accountInput.extend({
      gigId: z.string().min(1).max(200),
      recipient: z.string().max(254),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(30000),
    }),
  )
  .handler(async ({ context, data }) => {
    await ownedMailbox(context.userId, data.accountId);
    const sql = await getSql();
    const [state] = await sql.query<{ state: { gigs?: { id: string }[] } }>(
      "select state from app_state where user_id=$1",
      [context.userId],
    );
    if (!state?.state.gigs?.some((g) => g.id === data.gigId))
      throw new Error("Save this booking first.");
    const id = randomUUID(),
      recipient = normalizeRecipient(data.recipient);
    encodeGmailMessage({ recipient, subject: data.subject, body: data.body, key: id });
    await event(context.userId, data.accountId, "draft-saved");
    await sql.query(
      "insert into mailbox_drafts(id,user_id,account_id,gig_id,recipient,subject,body) values($1,$2,$3,$4,$5,$6,$7)",
      [id, context.userId, data.accountId, data.gigId, recipient, data.subject, data.body],
    );
    return { id };
  });
export const exportOutlookDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [draft] = await sql.query<{
      account_id: string;
      recipient: string;
      subject: string;
      body: string;
    }>(
      "select account_id,recipient,subject,body from mailbox_drafts where id=$1 and user_id=$2 and export_status='local'",
      [data.id, context.userId],
    );
    if (!draft)
      throw new Error(
        "Draft already exported, in progress or unavailable. Check Outlook before retrying.",
      );
    const { account, token } = await mailboxToken(context.userId, draft.account_id, "drafts");
    if (account.providerId !== "microsoft") throw new Error("Select an Outlook mailbox.");
    await event(context.userId, draft.account_id, "draft-export-started");
    const claimed = await sql.query(
      "update mailbox_drafts set export_status='unknown' where id=$1 and user_id=$2 and export_status='local' returning id",
      [data.id, context.userId],
    );
    if (!claimed.length) throw new Error("Draft export already started. Check Outlook.");
    // A network failure after creation is ambiguous. Never automatically create another draft.
    try {
      const result = await mailboxFetch(token, "https://graph.microsoft.com/v1.0/me/messages", {
        method: "POST",
        body: JSON.stringify({
          subject: draft.subject,
          body: { contentType: "Text", content: draft.body },
          toRecipients: [{ emailAddress: { address: draft.recipient } }],
        }),
      });
      if (typeof result?.id !== "string") throw new Error();
      await sql.query(
        "update mailbox_drafts set provider_draft_id=$3,export_status='exported' where id=$1 and user_id=$2",
        [data.id, context.userId, result.id],
      );
      return { ok: true };
    } catch {
      throw new Error(
        "Outlook draft creation was not confirmed. Check your Drafts folder before creating another.",
      );
    }
  });

export const reviewMailboxDraft = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [draft] = await sql.query<{
      account_id: string;
      gig_id: string;
      recipient: string;
      subject: string;
      body: string;
    }>(
      "select account_id,gig_id,recipient,subject,body from mailbox_drafts where id=$1 and user_id=$2",
      [data.id, context.userId],
    );
    if (!draft) throw new Error("Draft unavailable.");
    const mailbox = await ownedMailbox(context.userId, draft.account_id);
    return { ...draft, provider: mailbox.providerId };
  });
