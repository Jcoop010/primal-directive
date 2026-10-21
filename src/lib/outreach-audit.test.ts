import { strict as assert } from "node:assert";
import { test } from "node:test";
import { reserveOutreach, settleOutreach, isOutreachRetrySafe, type SendAuditEvent } from "./outreach-audit.ts";
const pending: SendAuditEvent = {
  idempotencyKey: "u:g:recipient:fingerprint", userId: "u", gigId: "g",
  recipient: "venue@example.com", status: "reserved",
  createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z",
};
test("outreach reservation rejects duplicate and malformed requests", () => {
  const records = reserveOutreach([], pending);
  assert.equal(records.length, 1);
  assert.throws(() => reserveOutreach(records, pending));
  assert.throws(() => reserveOutreach([], { ...pending, status: "sent" }));
});
test("sent status requires provider receipt and cannot settle twice", () => {
  assert.throws(() => settleOutreach([pending], pending.idempotencyKey, "sent", pending.updatedAt));
  const sent = settleOutreach([pending], pending.idempotencyKey, "sent", pending.updatedAt, "gmail-message-id");
  assert.equal(sent[0].status, "sent");
  assert.throws(() => settleOutreach(sent, pending.idempotencyKey, "sent", pending.updatedAt, "again"));
});
test("unknown delivery is not automatically retried", () => {
  const unknown = settleOutreach([pending], pending.idempotencyKey, "unknown", pending.updatedAt);
  assert.equal(isOutreachRetrySafe(unknown[0]), false);
  assert.equal(isOutreachRetrySafe(pending), false);
});
