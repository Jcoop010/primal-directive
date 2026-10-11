import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionShow,
  showWorkflowKey,
  summarizeShowFinances,
} from "./band-ops.ts";

describe("show lifecycle transitions", () => {
  it("allows the normal booking-to-settlement path", () => {
    const path = [
      ["lead", "researched"],
      ["researched", "qualified"],
      ["qualified", "outreach_ready"],
      ["outreach_ready", "contacted"],
      ["contacted", "negotiating"],
      ["negotiating", "contracted"],
      ["contracted", "confirmed"],
      ["confirmed", "advancing"],
      ["advancing", "performed"],
      ["performed", "settling"],
      ["settling", "settled"],
    ] as const;
    for (const [from, to] of path) {
      assert.equal(canTransitionShow(from, to).ok, true, `${from} -> ${to}`);
    }
  });

  it("does not allow a hold to be mistaken for a confirmed show lifecycle completion", () => {
    assert.equal(canTransitionShow("hold", "performed").ok, false);
    assert.equal(canTransitionShow("lead", "settled").ok, false);
  });

  it("rejects no-op transitions with a useful reason", () => {
    const result = canTransitionShow("confirmed", "confirmed");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /already/i);
  });
});

describe("show financial summary", () => {
  it("separates estimates from actuals and calculates net correctly", () => {
    const summary = summarizeShowFinances([
      { label: "Guarantee", amount: 1200, kind: "income", status: "expected" },
      { label: "Merch", amount: 250, kind: "income", status: "actual" },
      { label: "Travel estimate", amount: 180, kind: "expense", status: "expected" },
      { label: "Fuel", amount: 70, kind: "expense", status: "actual" },
    ]);
    assert.deepEqual(summary, {
      expectedIncome: 1200,
      actualIncome: 250,
      expectedExpenses: 180,
      actualExpenses: 70,
      expectedNet: 1020,
      actualNet: 180,
      unverifiedLines: 2,
    });
  });

  it("rejects negative, infinite, and NaN amounts", () => {
    for (const amount of [-1, Infinity, NaN]) {
      assert.throws(
        () =>
          summarizeShowFinances([
            { label: "Bad line", amount, kind: "income", status: "actual" },
          ]),
        /finite and non-negative/i,
      );
    }
  });
});

describe("show workflow idempotency key", () => {
  it("normalizes workflow name and produces stable keys", () => {
    assert.equal(
      showWorkflowKey("show-123", "Create Calendar Event"),
      "show:show-123:workflow:create calendar event:v1",
    );
    assert.equal(
      showWorkflowKey("show-123", "create calendar event", 1),
      showWorkflowKey("show-123", "Create Calendar Event", 1),
    );
  });

  it("rejects empty IDs and invalid versions", () => {
    assert.throws(() => showWorkflowKey("", "calendar"), /required/i);
    assert.throws(() => showWorkflowKey("show-1", "calendar", 0), /positive integer/i);
  });
});
