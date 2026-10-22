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
/** Only allowlisted provider codes influence public errors; raw messages,
 * activation URLs, identifiers and OAuth data are never returned or logged. */
export function mailboxFailure(
  status: number,
  provider: MailProvider | undefined,
  payload: unknown,
): { code: string; message: string } {
  const error =
    payload && typeof payload === "object" ? (payload as { error?: unknown }).error : undefined;
  const data =
    error && typeof error === "object"
      ? (error as { code?: unknown; errors?: unknown; details?: unknown })
      : {};
  const reasons: string[] = [];
  if (typeof data.code === "string") reasons.push(data.code);
  for (const list of [data.errors, data.details])
    if (Array.isArray(list))
      for (const item of list.slice(0, 20)) {
        if (item && typeof item === "object" && typeof item.reason === "string")
          reasons.push(item.reason);
      }
  const normalized = reasons.map((r) => r.toLowerCase());
  const has = (...codes: string[]) => codes.some((c) => normalized.includes(c.toLowerCase()));
  if (status === 401)
    return {
      code: "authorization-expired",
      message: "Authorization expired or was revoked. Reconnect this mailbox.",
    };
  if (provider === "google" && status === 403) {
    if (has("accessNotConfigured", "SERVICE_DISABLED", "serviceDisabled"))
      return {
        code: "gmail-api-disabled",
        message:
          "Gmail API is disabled or has not been enabled for this application's Google Cloud project. The app owner must enable Gmail API in Google Cloud, then check the inbox again. Reconnecting alone will not fix this.",
      };
    if (has("insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT"))
      return {
        code: "gmail-token-scope-insufficient",
        message:
          "Gmail rejected the current token's permissions, despite the saved consent record. Reconnect Gmail with inbox access, then check the inbox again.",
      };
    if (has("domainPolicy", "ORG_RESTRICTION_VIOLATION"))
      return {
        code: "gmail-domain-policy",
        message:
          "Gmail access is blocked by your Google Workspace administrator's policy. Ask the administrator to allow this application.",
      };
    if (has("rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded", "quotaExceeded"))
      return {
        code: "gmail-quota",
        message:
          "Provider rate limit or Gmail quota reached. Wait before checking the inbox again.",
      };
    return {
      code: "gmail-forbidden-unclassified",
      message:
        "Gmail returned HTTP 403. Saved permissions do not prove API access. The cause could be Google Cloud API configuration, token scopes, or an account policy; it has not been identified yet.",
    };
  }
  if (status === 403)
    return {
      code: "permission-denied",
      message: "Mailbox permission was denied. Review consent or your organization's policy.",
    };
  if (status === 429)
    return {
      code: "rate-limit",
      message: "Provider rate limit reached. Wait before synchronizing again.",
    };
  return {
    code: "provider-unavailable",
    message: "The email provider is unavailable. Try again later.",
  };
}
export function mailboxError(status: number): string {
  return mailboxFailure(status, undefined, null).message;
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
