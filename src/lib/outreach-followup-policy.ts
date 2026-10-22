export type ThreadMessage = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: {
    headers?: { name?: string; value?: string }[];
    body?: { data?: string };
    parts?: { mimeType?: string; body?: { data?: string } }[];
  };
};
export function classifyBookingReply(
  text: string,
): "opt_out" | "interested" | "declined" | "unclassified" {
  if (
    /\b(unsubscribe|remove me|do not (?:email|contact)|stop (?:emailing|contacting))\b/i.test(text)
  )
    return "opt_out";
  if (/\b(not interested|no availability|unable to book|not a fit)\b/i.test(text))
    return "declined";
  if (/\b(interested|send (?:your|us)|available dates|let['’]s discuss)\b/i.test(text))
    return "interested";
  return "unclassified";
}
/** Any correlated inbound message stops follow-ups, even an ambiguous reply. */
export function matchedBookingReplies(
  messages: ThreadMessage[],
  input: { recipient: string; threadId: string; sentAt: number },
) {
  return messages
    .filter((m) => {
      const from = m.payload?.headers?.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
      const mailbox = (from.match(/<([^<>]+)>/)?.[1] ?? from).trim().toLowerCase();
      return (
        typeof m.id === "string" &&
        m.threadId === input.threadId &&
        mailbox === input.recipient.toLowerCase() &&
        !m.labelIds?.includes("SENT") &&
        Number(m.internalDate) > input.sentAt
      );
    })
    .map((m) => {
      const encoded =
        m.payload?.parts?.find((p) => p.mimeType === "text/plain")?.body?.data ??
        m.payload?.body?.data ??
        "";
      const text = Buffer.from(encoded.slice(0, 45000), "base64url")
        .toString("utf8")
        .slice(0, 30000);
      return { messageId: m.id!, classification: classifyBookingReply(text) };
    });
}
