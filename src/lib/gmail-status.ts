import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "./auth/middleware";
import { getSql } from "./db";
import { mailboxToken, mailboxFetch, rateMailboxAction } from "./mailbox-provider.server";
import { hasMailScope, parseMailScopes } from "./mailbox-policy";
/** Current user only; an API check is distinct from stored consent. */
export const getGmailConnectionStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const [a] = await sql.query<{ id: string; scope: string | null; enabled: boolean }>(
      `select a.id,a.scope,coalesce(c.enabled,true) enabled from account a left join mailbox_connections c on c.user_id=a."userId" and c.account_id=a.id where a."userId"=$1 and a."providerId"='google'`,
      [context.userId],
    );
    const scopes = parseMailScopes(a?.scope ?? null),
      gmailReadAuthorized = Boolean(a?.enabled && hasMailScope("google", scopes, "read")),
      gmailSendAuthorized = Boolean(a?.enabled && hasMailScope("google", scopes, "send"));
    let apiVerified = false,
      error: string | null = null;
    if (a && gmailReadAuthorized)
      try {
        await rateMailboxAction(context.userId, a.id, "health-check");
        const { token } = await mailboxToken(context.userId, a.id, "read");
        const result = await mailboxFetch(
          token,
          "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        );
        apiVerified = typeof result?.emailAddress === "string";
        if (!apiVerified) error = "Gmail returned an invalid mailbox profile.";
      } catch (e) {
        error =
          e instanceof Error &&
          /^(Authorization|Mailbox|Provider rate|The email provider)/.test(e.message)
            ? e.message
            : "Gmail verification failed. Try again or reconnect.";
      }
    return {
      googleLinked: Boolean(a),
      gmailReadAuthorized,
      gmailSendAuthorized,
      apiVerified,
      error,
    };
  });
