import assert from "node:assert/strict";
import testCase from "node:test";
import { changesPayoutIdentity, hasGigLinkedFinancialHistory, hasRecordedPayouts } from "./contact-integrity.ts";
import type { MoneyEntry } from "./types.ts";

const entry = (id: string, type: MoneyEntry["type"], memberId?: string): MoneyEntry => ({
  id, type, amount: 25, label: id, date: "2026-10-13", memberId,
});

testCase("detects member payout history by exact contact id", () => {
  assert.equal(hasRecordedPayouts("member-a", [entry("payout", "payout", "member-a")]), true);
  assert.equal(hasRecordedPayouts("member-b", [entry("payout", "payout", "member-a")]), false);
});

testCase("keeps contacts protected when several partial payouts exist", () => {
  assert.equal(hasRecordedPayouts("member-a", [
    entry("first-part", "payout", "member-a"),
    entry("second-part", "payout", "member-a"),
  ]), true);
});

testCase("does not treat income or operating costs as member payout history", () => {
  assert.equal(hasRecordedPayouts("member-a", [
    entry("income", "collected", "member-a"),
    entry("cost", "cost", "member-a"),
    entry("unlinked-payout", "payout"),
  ]), false);
});

testCase("locks payout role and share after payments while allowing unrelated edits", () => {
  const history = [entry("payout", "payout", "member-a")];
  const current = { role: "member", settlementSharePercent: 50 };
  assert.equal(changesPayoutIdentity("member-a", current, { settlementSharePercent: 40 }, history), true);
  assert.equal(changesPayoutIdentity("member-a", current, { role: "band" }, history), true);
  assert.equal(changesPayoutIdentity("member-a", current, {}, history), false);
  assert.equal(changesPayoutIdentity("member-a", current, { settlementSharePercent: 50 }, history), false);
  assert.equal(changesPayoutIdentity("member-a", current, { settlementSharePercent: 40 }, []), false);
});

testCase("protects show closeout when ledger, merch sales, orders, or adjustments are linked", () => {
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [{ ...entry("income", "collected"), gigId: "gig-1" }], [], [], []), true);
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [], [{ gigId: "gig-1" }], [], []), true);
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [], [], [{ gigId: "gig-1" }], []), true);
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [], [], [], [{ gigId: "gig-1" }]), true);
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [ { ...entry("other", "collected"), gigId: "gig-2" } ], [], [], []), false);
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [], [], [], []), false);
});
