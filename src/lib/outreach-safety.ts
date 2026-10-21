/** Pure fail-closed policy for any future autonomous booking email transport.
 * Callers must persist approvals, reservations and audit events in a durable
 * account-scoped store before integrating with an external mail provider.
 */
export type OutreachDecision = { allowed: true; idempotencyKey: string } | { allowed: false; reason: string };
export type OutreachPolicyInput = {
  userId: string;
  gigId: string;
  recipient: string;
  explicitApproval: boolean;
  providerAuthorized: boolean;
  verifiedBookingContact: boolean;
  dryRun: boolean;
  nowMs: number;
  recentSendTimesMs: number[];
  alreadySentKeys: string[];
  reservedKeys: string[];
  messageFingerprint: string;
};
export function evaluateOutreach(input: OutreachPolicyInput): OutreachDecision {
  const deny = (reason: string): OutreachDecision => ({ allowed: false, reason });
  if (!input.explicitApproval) return deny("explicit-approval-required");
  if (!input.providerAuthorized) return deny("provider-authorization-required");
  if (!input.verifiedBookingContact) return deny("verified-contact-required");
  if (input.dryRun) return deny("dry-run-does-not-send");
  const recipient = input.recipient.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254) return deny("invalid-recipient");
  if (!input.userId || !input.gigId || !/^[a-zA-Z0-9_-]{16,128}$/.test(input.messageFingerprint)) return deny("invalid-identifiers");
  if (!Number.isFinite(input.nowMs) || !Array.isArray(input.recentSendTimesMs) || !Array.isArray(input.alreadySentKeys) || !Array.isArray(input.reservedKeys)) return deny("missing-audit-data");
  const recent = input.recentSendTimesMs.filter((time) => Number.isFinite(time) && time <= input.nowMs && time > input.nowMs - 86400000);
  if (recent.length >= 20) return deny("daily-rate-limit");
  if (recent.filter((time) => time > input.nowMs - 3600000).length >= 5) return deny("hourly-rate-limit");
  const idempotencyKey = [input.userId, input.gigId, recipient, input.messageFingerprint].join(":");
  if (input.alreadySentKeys.includes(idempotencyKey) || input.reservedKeys.includes(idempotencyKey)) return deny("duplicate-or-in-flight");
  return { allowed: true, idempotencyKey };
}
