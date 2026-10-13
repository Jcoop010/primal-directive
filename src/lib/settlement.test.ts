import assert from "node:assert/strict";
import testCase from "node:test";
import { calculateSettlement, isPayoutMember, parsePayoutAmount } from "./settlement.ts";
import { hasGigLinkedFinancialHistory } from "./contact-integrity.ts";
import type { MoneyEntry, Person } from "./types.ts";
const members: Person[] = [
  { id: "a", name: "Alex", role: "member", city: "", contact: "", notes: "", settlementSharePercent: 50 },
  { id: "b", name: "Blair", role: "member", city: "", contact: "", notes: "", settlementSharePercent: 50 },
];
const entry = (id: string, type: MoneyEntry["type"], amount: number, extra: Partial<MoneyEntry> = {}): MoneyEntry => ({ id, type, amount, label: id, date: "2026-10-13", gigId: "show-1", ...extra });
testCase("validates partial payouts to cents without allowing overpayment", () => {
  assert.equal(parsePayoutAmount("12.34", 50), 12.34);
  assert.equal(parsePayoutAmount("12.345", 50), 12.35);
  assert.equal(parsePayoutAmount("50.01", 50), null);
  assert.equal(parsePayoutAmount("0", 50), null);
  assert.equal(parsePayoutAmount("-1", 50), null);
  assert.equal(parsePayoutAmount(" ", 50), null);
  assert.equal(parsePayoutAmount("1", 0), null);
});

testCase("only individual members or explicitly configured legacy contacts are payout eligible", () => {
  assert.equal(isPayoutMember({ role: "member", settlementSharePercent: undefined }), true);
  assert.equal(isPayoutMember({ role: "band", settlementSharePercent: undefined }), false);
  assert.equal(isPayoutMember({ role: "band", settlementSharePercent: 50 }), true);
  assert.equal(isPayoutMember({ role: "booker", settlementSharePercent: 50 }), false);
});
testCase("splits collected cash after linked operating costs", () => {
  const result = calculateSettlement("show-1", members, [entry("guarantee", "collected", 1000), entry("fuel", "cost", 100), entry("owed", "outstanding", 500)]);
  assert.equal(result.netPool, 900); assert.equal(result.sharesValid, true); assert.deepEqual(result.lines.map((line) => line.amountDue), [450, 450]); assert.equal(result.totalRemaining, 900);
});
testCase("payout reversals cannot create negative paid totals or inflate remaining allocation", () => {
  const result = calculateSettlement("show-1", members, [
    entry("guarantee", "collected", 100),
    entry("payout-a", "payout", 10, { memberId: "a" }),
    entry("reversal-a", "payout", -20, { memberId: "a" }),
  ]);
  assert.equal(result.lines[0].amountPaid, 0);
  assert.equal(result.lines[0].remaining, result.lines[0].amountDue);
});

testCase("tracks partial payouts separately from operating costs", () => {
  const result = calculateSettlement("show-1", members, [entry("guarantee", "collected", 100), entry("payout-a", "payout", 20, { memberId: "a" })]);
  assert.equal(result.lines[0].amountPaid, 20); assert.equal(result.lines[0].remaining, 30); assert.equal(result.operatingCosts, 0); assert.equal(result.totalPaid, 20);
});
testCase("refuses allocations when shares are missing or do not total 100 percent", () => {
  const missing = calculateSettlement("show-1", [members[0], { id: "b", name: "Blair", role: "member", city: "", contact: "", notes: "" }], [entry("guarantee", "collected", 100)]);
  assert.equal(missing.sharesValid, false); assert.deepEqual(missing.missingShareNames, ["Blair"]); assert.equal(missing.totalRemaining, 0);
  const invalid = calculateSettlement("show-1", members.map((person) => ({ ...person, settlementSharePercent: 40 })), [entry("guarantee", "collected", 100)]);
  assert.equal(invalid.sharesValid, false);
});
testCase("never allocates a negative pool and preserves cent totals", () => {
  const splitMembers: Person[] = [{ ...members[0], settlementSharePercent: 33.33 }, { ...members[1], settlementSharePercent: 33.33 }, { id: "c", name: "Casey", role: "member", city: "", contact: "", notes: "", settlementSharePercent: 33.34 }];
  const result = calculateSettlement("show-1", splitMembers, [entry("guarantee", "collected", 10), entry("cost", "cost", 25)]);
  assert.equal(result.netPool, 0); assert.equal(result.totalRemaining, 0);
  const positive = calculateSettlement("show-1", splitMembers, [entry("guarantee", "collected", 10)]);
  assert.equal(positive.lines.reduce((sum, line) => sum + line.amountDue, 0), 10);
});

testCase("a show with linked ledger history cannot be deleted without losing reconciliation", () => {
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [{ gigId: "gig-1" }], [], [], []), true);
});

testCase("linked merch sales, orders, and inventory adjustments also protect show history", () => {
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [], [{ gigId: "gig-1" }], [], []), true);
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [], [], [{ gigId: "gig-1" }], []), true);
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [], [], [], [{ gigId: "gig-1" }]), true);
});

testCase("unrelated financial records do not block deletion of an empty show", () => {
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [{ gigId: "gig-2" }], [], [], []), false);
  assert.equal(hasGigLinkedFinancialHistory("gig-1", [], [], [], []), false);
});
