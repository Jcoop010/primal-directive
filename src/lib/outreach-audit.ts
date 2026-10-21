/** Account-scoped audit state for a future outbound transport.
 * Never retry a reserved send blindly after a timeout: delivery is unknown.
 * Production callers must persist this state atomically with a unique key.
 */
export type SendAuditStatus = "reserved" | "sent" | "failed" | "unknown";
export type SendAuditEvent = {
  idempotencyKey: string;
  userId: string;
  gigId: string;
  recipient: string;
  status: SendAuditStatus;
  createdAt: string;
  updatedAt: string;
  providerMessageId?: string;
};
export function reserveOutreach(existing: readonly SendAuditEvent[], candidate: SendAuditEvent): SendAuditEvent[] {
  if (candidate.status !== "reserved" || !candidate.idempotencyKey || !candidate.userId || !candidate.gigId) {
    throw new Error("Invalid outreach reservation");
  }
  if (existing.some((event) => event.idempotencyKey === candidate.idempotencyKey)) {
    throw new Error("Duplicate outreach reservation");
  }
  return [...existing, candidate];
}
export function settleOutreach(existing: readonly SendAuditEvent[], key: string, status: Exclude<SendAuditStatus, "reserved">, updatedAt: string, providerMessageId?: string): SendAuditEvent[] {
  const current = existing.find((event) => event.idempotencyKey === key);
  if (!current || current.status !== "reserved") throw new Error("Outreach not pending");
  if (status === "sent" && !providerMessageId) throw new Error("Provider receipt required");
  return existing.map((event) => event.idempotencyKey === key
    ? { ...event, status, updatedAt, ...(providerMessageId ? { providerMessageId } : {}) }
    : event);
}
export function isOutreachRetrySafe(event: SendAuditEvent): boolean {
  // Failed/unknown/reserved may have reached the provider; require human review.
  return false;
}
