export type MailProvider = "google" | "microsoft";
export const MAIL_SCOPES = {
  google: {
    read: "https://www.googleapis.com/auth/gmail.readonly",
    send: "https://www.googleapis.com/auth/gmail.send",
    drafts: "https://www.googleapis.com/auth/gmail.compose",
  },
  microsoft: { read: "Mail.ReadBasic", send: "Mail.Send", drafts: "Mail.ReadWrite" },
} as const;
export function parseMailScopes(scope: string | null): string[] {
  return (scope ?? "").split(/[\s,]+/).filter(Boolean);
}
export function hasMailScope(
  provider: MailProvider,
  scopes: string[],
  purpose: "read" | "send" | "drafts",
) {
  const normalized = scopes.map((s) =>
    s.replace(/^https:\/\/graph.microsoft.com\//i, "").toLowerCase(),
  );
  return (
    normalized.includes(MAIL_SCOPES[provider][purpose].toLowerCase()) ||
    (provider === "microsoft" &&
      purpose === "read" &&
      (normalized.includes("mail.readwrite") || normalized.includes("mail.read")))
  );
}
/** Union previous grants when upgrading permissions; never exchange read access for send access. */
export function mailboxConsentScopes(
  provider: MailProvider,
  existing: string[],
  purpose: "read" | "send" | "drafts",
) {
  return [
    ...new Set([
      ...existing,
      MAIL_SCOPES[provider][purpose],
      ...(provider === "microsoft" ? ["offline_access"] : []),
    ]),
  ];
}
export function mailboxError(status: number): string {
  if (status === 401) return "Authorization expired or was revoked. Reconnect this mailbox.";
  if (status === 403)
    return "Mailbox permission was denied. Review consent or your organization’s policy.";
  if (status === 429) return "Provider rate limit reached. Wait before synchronizing again.";
  return "The email provider is unavailable. Try again later.";
}
export type MailHeader = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  replyTo: string;
};
export function graphHeaders(value: unknown): MailHeader[] {
  if (!value || typeof value !== "object") throw new Error("Invalid provider response");
  const rows = (value as { value?: unknown }).value;
  if (!Array.isArray(rows)) throw new Error("Invalid provider response");
  return rows.slice(0, 10).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const m = row as {
      id?: unknown;
      conversationId?: unknown;
      subject?: unknown;
      receivedDateTime?: unknown;
      from?: { emailAddress?: { address?: unknown } };
      internetMessageHeaders?: { name?: string; value?: string }[];
    };
    if (typeof m.id !== "string" || typeof m.conversationId !== "string") return [];
    const text = (v: unknown, max = 320) => (typeof v === "string" ? v.slice(0, max) : "");
    return [
      {
        id: text(m.id, 1024),
        threadId: text(m.conversationId, 1024),
        from: text(m.from?.emailAddress?.address),
        subject: text(m.subject),
        date: text(m.receivedDateTime, 128),
        replyTo: text(
          m.internetMessageHeaders?.find((h) => h.name?.toLowerCase() === "in-reply-to")?.value,
          1024,
        ),
      },
    ];
  });
}
