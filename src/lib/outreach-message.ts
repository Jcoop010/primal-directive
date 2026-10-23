import { createHash } from "node:crypto";
export const OUTREACH_POLICY_VERSION = "2026-10-22-v1";
export function normalizeRecipient(value: string): string {
  const recipient = value.trim().toLowerCase();
  // Exactly one mailbox; never permit header injection or recipient lists.
  if (
    recipient.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(recipient)
  )
    throw new Error("Enter one valid email address");
  return recipient;
}
export function messageFingerprint(recipient: string, subject: string, body: string): string {
  return createHash("sha256")
    .update(JSON.stringify([normalizeRecipient(recipient), subject, body]))
    .digest("hex");
}
export function outreachInternetMessageId(key: string): string {
  return `<${createHash("sha256").update(key).digest("hex")}@primal-directive-loose-ends-co.vercel.app>`;
}
export function encodeGmailMessage(input: {
  recipient: string;
  subject: string;
  body: string;
  key: string;
}): string {
  const recipient = normalizeRecipient(input.recipient);
  if (
    !input.subject.trim() ||
    input.subject.length > 200 ||
    Array.from(input.subject).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    throw new Error("Invalid subject");
  if (!input.body.trim() || Buffer.byteLength(input.body) > 50000)
    throw new Error("Invalid message body");
  // RFC 2047 encoded words must stay under 75 characters, including delimiters.
  // Split at Unicode code points so each word independently decodes as UTF-8.
  const chunks: string[] = [];
  let chunk = "";
  for (const point of input.subject) {
    if (Buffer.byteLength(chunk + point) > 42) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += point;
  }
  if (chunk) chunks.push(chunk);
  const subject = chunks
    .map((part) => `=?UTF-8?B?${Buffer.from(part).toString("base64")}?=`)
    .join("\r\n ");
  const content =
    Buffer.from(input.body.replace(/\r?\n/g, "\r\n"))
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? "";
  const id = outreachInternetMessageId(input.key);
  return Buffer.from(
    [
      `To: ${recipient}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${id}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      content,
    ].join("\r\n"),
  ).toString("base64url");
}
export type GmailDelivery =
  | { status: "sent"; messageId: string; threadId?: string }
  | { status: "failed" | "unknown"; reason: string };
/** One attempt only. Timeouts, 5xx, and malformed success receipts require manual reconciliation. */
export async function deliverGmail(
  token: string,
  raw: string,
  request: typeof fetch = fetch,
): Promise<GmailDelivery> {
  try {
    const response = await request("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      return {
        status: response.status >= 500 ? "unknown" : "failed",
        reason: `provider-${response.status}`,
      };
    const data = (await response.json()) as { id?: string; threadId?: string };
    if (typeof data.id !== "string" || !data.id)
      return { status: "unknown", reason: "missing-provider-receipt" };
    return {
      status: "sent",
      messageId: data.id,
      ...(typeof data.threadId === "string" ? { threadId: data.threadId } : {}),
    };
  } catch {
    return { status: "unknown", reason: "provider-timeout-or-network-error" };
  }
}

/** Graph sendMail returns 202 with no delivery receipt. Keep it unreconciled;
 * never claim delivery or retry blindly, even on a nominally successful submission. */
export async function deliverOutlook(
  token: string,
  message: { recipient: string; subject: string; body: string; key: string },
  request: typeof fetch = fetch,
): Promise<GmailDelivery> {
  const raw = encodeGmailMessage(message);
  try {
    const response = await request("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
      signal: AbortSignal.timeout(10000),
      body: Buffer.from(raw, "base64url").toString("base64"),
    });
    if (response.status === 202)
      return { status: "unknown", reason: "provider-accepted-delivery-unverified" };
    return {
      status: response.status >= 500 || response.ok ? "unknown" : "failed",
      reason: `provider-${response.status}`,
    };
  } catch {
    return { status: "unknown", reason: "provider-timeout-or-network-error" };
  }
}
