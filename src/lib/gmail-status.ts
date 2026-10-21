import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import { getRequest } from "@tanstack/react-start/server";

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
    const grants = rows.map((row) => new Set((row.scope ?? "").split(/\s+/).filter(Boolean)));
    const gmailReadAuthorized = grants.some((scopes) => scopes.has(GMAIL_READ));
    const gmailSendAuthorized = grants.some((scopes) => scopes.has(GMAIL_SEND));
    let apiVerified = false;
    if (gmailReadAuthorized) {
      try {
        const request = getRequest();
        if (request) {
          const token = await auth.api.getAccessToken({
            body: { providerId: "google" },
            headers: request.headers,
          });
          if (token?.accessToken) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            try {
              const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
                headers: { Authorization: `Bearer ${token.accessToken}` },
                signal: controller.signal,
              });
              apiVerified = response.ok;
            } finally {
              clearTimeout(timeout);
            }
          }
        }
      } catch {
        // Expired, revoked, or unavailable Gmail grants must never be reported as connected.
      }
    }
    return {
      googleLinked: rows.length > 0,
      gmailReadAuthorized,
      gmailSendAuthorized,
      apiVerified,
    };
  });
