import { strict as assert } from "node:assert";
import { test } from "node:test";
import { evaluateOutreach, type OutreachPolicyInput } from "./outreach-safety.ts";

const base: OutreachPolicyInput = {
  userId: "user-1", gigId: "gig-1", recipient: "venue@example.com",
  explicitApproval: true, providerAuthorized: true, verifiedBookingContact: true,
  dryRun: false, nowMs: 1_800_000_000_000, recentSendTimesMs: [],
  alreadySentKeys: [], reservedKeys: [], messageFingerprint: "abcdefghijklmnop",
};
test("outreach requires consent, authorization and verified contact", () => {
  for (const key of ["explicitApproval", "providerAuthorized", "verifiedBookingContact"] as const) {
    assert.equal(evaluateOutreach({ ...base, [key]: false }).allowed, false);
  }
});
test("dry runs and invalid recipients never send", () => {
  assert.equal(evaluateOutreach({ ...base, dryRun: true }).allowed, false);
  assert.equal(evaluateOutreach({ ...base, recipient: "not-an-email" }).allowed, false);
});
test("hourly and daily limits deny excessive sends", () => {
  assert.equal(evaluateOutreach({ ...base, recentSendTimesMs: Array(5).fill(base.nowMs - 1000) }).allowed, false);
  assert.equal(evaluateOutreach({ ...base, recentSendTimesMs: Array(20).fill(base.nowMs - 7200000) }).allowed, false);
});
test("sent and reserved keys prevent duplicates", () => {
  const decision = evaluateOutreach(base);
  assert.equal(decision.allowed, true);
  if (!decision.allowed) return;
  assert.equal(evaluateOutreach({ ...base, alreadySentKeys: [decision.idempotencyKey] }).allowed, false);
  assert.equal(evaluateOutreach({ ...base, reservedKeys: [decision.idempotencyKey] }).allowed, false);
});
