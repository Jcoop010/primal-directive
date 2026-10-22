import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "./auth/middleware";
import { getSql } from "./db";
import { mailboxToken, readMailboxHeaders, rateMailboxAction } from "./mailbox-provider.server";
async function read(userId: string) {
  const sql = await getSql();
  const [account] = await sql.query<{ id: string }>(
    'select id from account where "userId"=$1 and "providerId"=\'google\'',
    [userId],
  );
  if (!account) throw new Error("Connect Gmail from your account.");
  await rateMailboxAction(userId, account.id, "preview");
  const { token } = await mailboxToken(userId, account.id, "read");
  return readMailboxHeaders(token, "google");
}
export const previewGmailInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      return {
        connected: true,
        messages: (await read(context.userId)).map((m) => ({ id: m.id, threadId: m.threadId })),
        error: null,
      };
    } catch {
      return {
        connected: false,
        messages: [] as { id: string; threadId: string }[],
        error: "Gmail access is unavailable. Check your account connection and reconnect.",
      };
    }
  });
export const previewGmailReplyHeaders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      return {
        connected: true,
        replies: (await read(context.userId)).filter((m) => m.replyTo),
        error: null,
      };
    } catch {
      return {
        connected: false,
        replies: [] as {
          id: string;
          threadId: string;
          from: string;
          subject: string;
          date: string;
        }[],
        error: "Gmail reply headers could not be read. Check your account connection.",
      };
    }
  });
