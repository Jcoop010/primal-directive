import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAutomationRun, isTerminalAutomationRun, transitionAutomationRun, type AutomationRun } from "./automation-runner.ts";

const now = "2026-10-11T20:00:00.000Z";
const makeRun = (overrides: Partial<AutomationRun> = {}) => ({
  ...createAutomationRun({ id: "run-1", bandId: "band-1", action: "research_venue", idempotencyKey: "band-1:research:venue-1", now }),
  ...overrides,
});
const move = (run: AutomationRun, status: Parameters<typeof transitionAutomationRun>[1], options: Parameters<typeof transitionAutomationRun>[2] = { now }) => transitionAutomationRun(run, status, options);

describe("automation run state machine", () => {
  it("creates a queued run scoped to a band with an idempotency key", () => {
    const run = makeRun();
    assert.equal(run.status, "queued");
    assert.equal(run.bandId, "band-1");
    assert.equal(run.attempt, 0);
    assert.ok(run.idempotencyKey);
  });

  it("supports an approval gate before resuming execution", () => {
    const waiting = move(makeRun(), "awaiting_approval");
    assert.equal(waiting.ok, true);
    if (!waiting.ok) return;
    const denied = move(waiting.run, "queued");
    assert.equal(denied.ok, false);
    const approved = move(waiting.run, "queued", { now, approvedBy: "band-owner" });
    assert.equal(approved.ok, true);
    if (approved.ok) assert.equal(approved.run.approval?.approvedBy, "band-owner");
  });

  it("increments attempts only when execution starts", () => {
    const started = move(makeRun(), "running");
    assert.equal(started.ok, true);
    if (started.ok) assert.equal(started.run.attempt, 1);
  });

  it("requires a scheduled time for retries and caps attempts", () => {
    const started = move(makeRun(), "running");
    assert.ok(started.ok);
    if (!started.ok) return;
    assert.equal(move(started.run, "retry_scheduled").ok, false);
    const retry = move(started.run, "retry_scheduled", { now, nextAttemptAt: "2026-10-11T20:01:00.000Z" });
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    const secondStart = move(retry.run, "running");
    assert.equal(secondStart.ok, true);
    if (!secondStart.ok) return;
    const exhausted = move({ ...secondStart.run, status: "retry_scheduled", attempt: secondStart.run.maxAttempts, nextAttemptAt: "2026-10-11T20:02:00.000Z" }, "running");
    assert.equal(exhausted.ok, false);
  });

  it("requires an error summary for failed execution", () => {
    const started = move(makeRun(), "running");
    assert.ok(started.ok);
    if (!started.ok) return;
    assert.equal(move(started.run, "failed").ok, false);
    const failed = move(started.run, "failed", { now, error: "Provider timeout" });
    assert.equal(failed.ok, true);
    if (failed.ok) assert.equal(failed.run.lastError, "Provider timeout");
  });

  it("prevents transitions from terminal runs", () => {
    assert.equal(isTerminalAutomationRun("succeeded"), true);
    assert.equal(move(makeRun({ status: "succeeded" }), "running").ok, false);
  });

  it("rejects malformed run inputs", () => {
    assert.throws(() => createAutomationRun({ id: "", bandId: "b", action: "a", idempotencyKey: "k", now }));
    assert.throws(() => createAutomationRun({ id: "r", bandId: "b", action: "a", idempotencyKey: "k", now, maxAttempts: 0 }));
  });
});
