import test from "node:test";
import assert from "node:assert/strict";
import { evaluateOutreach } from "../src/lib/outreach-safety.ts";
import { graphHeaders, hasMailScope, mailboxConsentScopes } from "../src/lib/mailbox-policy.ts";

const base = {
  userId: "artist-test", gigId: "gig-test", recipient: "booking@example.com",
  explicitApproval: true, providerAuthorized: true, verifiedBookingContact: true,
  dryRun: false, nowMs: Date.UTC(2026, 9, 23),
  recentSendTimesMs: [], alreadySentKeys: [], reservedKeys: [],
  messageFingerprint: "abcdef0123456789",
};

test("outreach stays fail-closed without consent, authorization or verified booking contact", () => {
  for (const key of ["explicitApproval", "providerAuthorized", "verifiedBookingContact"]) {
    assert.equal(evaluateOutreach({ ...base, [key]: false }).allowed, false, key);
  }
  assert.equal(evaluateOutreach({ ...base, dryRun: true }).allowed, false);
});

test("duplicate and hourly-limited booking sends are rejected", () => {
  const first = evaluateOutreach(base);
  assert.equal(first.allowed, true);
  if (!first.allowed) return;
  assert.equal(evaluateOutreach({ ...base, alreadySentKeys: [first.idempotencyKey] }).allowed, false);
  assert.equal(evaluateOutreach({ ...base, reservedKeys: [first.idempotencyKey] }).allowed, false);
  assert.equal(evaluateOutreach({ ...base, recentSendTimesMs: Array(5).fill(base.nowMs - 1000) }).allowed, false);
});

test("Outlook read, draft and send permissions remain distinct", () => {
  assert.equal(hasMailScope("microsoft", ["Mail.ReadBasic"], "send"), false);
  assert.equal(hasMailScope("microsoft", ["Mail.ReadBasic"], "drafts"), false);
  const scopes = mailboxConsentScopes("microsoft", ["Mail.ReadBasic"], "drafts");
  assert.equal(hasMailScope("microsoft", scopes, "read"), true);
  assert.equal(hasMailScope("microsoft", scopes, "drafts"), true);
  assert.equal(hasMailScope("microsoft", scopes, "send"), false);
});

test("Outlook reply headers parse safely and preserve conversation linkage", () => {
  const messages = graphHeaders({ value: [{
    id: "reply-123", conversationId: "conversation-abc", subject: "Re: Booking test",
    receivedDateTime: "2026-10-23T14:00:00Z",
    from: { emailAddress: { address: "recipient@example.com" } },
    internetMessageHeaders: [{ name: "In-Reply-To", value: "<original@example.com>" }],
  }] });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].threadId, "conversation-abc");
  assert.equal(messages[0].replyTo, "<original@example.com>");
  assert.equal(messages[0].from, "recipient@example.com");
  assert.deepEqual(graphHeaders({ value: [null, { id: "bad" }] }), []);
});
