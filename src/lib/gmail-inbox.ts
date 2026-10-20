import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { authMiddleware } from "@/lib/auth/middleware";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

const READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Read-only, bounded Gmail message metadata. Never exposes OAuth tokens or message bodies. */
export const previewGmailInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const accounts = await sql.query<{ scope: string | null }>(
      'select scope from account where "userId" = $1 and "providerId" = $2',
      [context.userId, "google"],
    );
    if (!accounts.some((account) => (account.scope ?? "").split(/\s+/).includes(READ_SCOPE))) {
      return { connected: false, messages: [] as { id: string; threadId: string }[] };
    }
    const request = getRequest();
    if (!request) return { connected: false, messages: [] as { id: string; threadId: string }[] };
    try {
      const token = await auth.api.getAccessToken({
        body: { providerId: "google" },
        headers: request.headers,
      });
      if (!token?.accessToken) return { connected: false, messages: [] as { id: string; threadId: string }[] };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=in%3Ainbox",
          { headers: { Authorization: `Bearer ${token.accessToken}` }, signal: controller.signal },
        );
        if (!response.ok) return { connected: false, messages: [] as { id: string; threadId: string }[] };
        const result: unknown = await response.json();
        const data = result as { messages?: { id?: unknown; threadId?: unknown }[] };
        const messages = Array.isArray(data.messages) ? data.messages
          .filter((message) => typeof message.id === "string" && typeof message.threadId === "string")
          .slice(0, 10).map((message) => ({ id: message.id as string, threadId: message.threadId as string })) : [];
        return { connected: true, messages };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return { connected: false, messages: [] as { id: string; threadId: string }[] };
    }
  });
