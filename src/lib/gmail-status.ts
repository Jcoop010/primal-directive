import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

const GMAIL_READ = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send";

/** Reports account-specific consent status without exposing OAuth tokens. */
export const getGmailConnectionStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ scope: string | null }>(
      'select scope from account where "userId" = $1 and "providerId" = $2',
      [context.userId, "google"],
    );
    const scopes = new Set(rows.flatMap((row) => (row.scope ?? "").split(/\s+/).filter(Boolean)));
    return {
      googleLinked: rows.length > 0,
      gmailReadAuthorized: scopes.has(GMAIL_READ),
      gmailSendAuthorized: scopes.has(GMAIL_SEND),
      apiVerified: false,
    };
  });
