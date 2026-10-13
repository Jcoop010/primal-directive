import assert from "node:assert/strict";
import testCase from "node:test";
import { parseLedgerAmount } from "./money-ledger.ts";

testCase("accepts cent precision", () => {
  assert.equal(parseLedgerAmount("12.45"), 12.45);
});

testCase("accepts negative refunds and reversals", () => {
  assert.equal(parseLedgerAmount("-8.75"), -8.75);
});

testCase("rejects blank, zero, and non-finite amounts", () => {
  assert.equal(parseLedgerAmount(""), null);
  assert.equal(parseLedgerAmount("   "), null);
  assert.equal(parseLedgerAmount("0"), null);
  assert.equal(parseLedgerAmount("NaN"), null);
  assert.equal(parseLedgerAmount("Infinity"), null);
});
