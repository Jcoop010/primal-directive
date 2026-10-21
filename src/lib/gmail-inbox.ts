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

/** Manually inspect a bounded set of inbox reply headers; no message bodies or tokens leave the server. */
export const previewGmailReplyHeaders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const empty = { connected: false, replies: [] as { id: string; threadId: string; from: string; subject: string; date: string }[] };
    const sql = await getSql();
    const accounts = await sql.query<{ scope: string | null }>(
      'select scope from account where "userId" = $1 and "providerId" = $2',
      [context.userId, "google"],
    );
    if (!accounts.some((account) => (account.scope ?? "").split(/\\s+/).includes(READ_SCOPE))) return empty;
    const request = getRequest();
    if (!request) return empty;
    try {
      const token = await auth.api.getAccessToken({ body: { providerId: "google" }, headers: request.headers });
      if (!token?.accessToken) return empty;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const headers = { Authorization: `Bearer ${token.accessToken}` };
        const listResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=in%3Ainbox", { headers, signal: controller.signal });
        if (!listResponse.ok) return empty;
        const listing = await listResponse.json() as { messages?: { id?: string }[] };
        const ids = (listing.messages ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string").slice(0, 10);
        const replies = await Promise.all(ids.map(async (id) => {
          const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=In-Reply-To`, { headers, signal: controller.signal });
          if (!response.ok) return null;
          const message = await response.json() as { id?: string; threadId?: string; payload?: { headers?: { name?: string; value?: string }[] } };
          const fields = message.payload?.headers ?? [];
          const value = (name: string) => fields.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
          if (!value("In-Reply-To") || !message.id || !message.threadId) return null;
          return { id: message.id, threadId: message.threadId, from: value("From").slice(0, 320), subject: value("Subject").slice(0, 320), date: value("Date").slice(0, 128) };
        }));
        return { connected: true, replies: replies.filter((reply): reply is NonNullable<typeof reply> => reply !== null) };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return empty;
    }
  });
