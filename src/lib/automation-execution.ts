import { evaluateAutomationPermission, type AutomationAction, type AutomationPolicy } from "./automation-policy.ts";
import { transitionAutomationRun, type AutomationRun } from "./automation-runner.ts";

/** Pure, auditable orchestration boundary. Persistence and provider delivery belong to server adapters. */
export function planAutomationExecution(input: {
  run: AutomationRun;
  action: AutomationAction;
  policy: AutomationPolicy;
  now: string;
  existingRuns: readonly AutomationRun[];
}): { kind: "execute" | "approval" | "blocked" | "duplicate" | "wait"; reason: string; run: AutomationRun } {
  const { run, action, policy, now, existingRuns } = input;
  if (run.action !== action) return { kind: "blocked", reason: "Run action does not match requested action.", run };
  if (!Number.isFinite(Date.parse(now))) return { kind: "blocked", reason: "Invalid execution timestamp.", run };
  if (existingRuns.some(other => other.id !== run.id && other.bandId === run.bandId && other.idempotencyKey === run.idempotencyKey && other.status !== "cancelled" && other.status !== "failed")) {
    return { kind: "duplicate", reason: "Another active or completed run owns this idempotency key.", run };
  }
  if (run.status === "retry_scheduled" && (!run.nextAttemptAt || Date.parse(run.nextAttemptAt) > Date.parse(now))) {
    return { kind: "wait", reason: "Retry is not due yet.", run };
  }
  if (run.status !== "queued" && run.status !== "retry_scheduled") return { kind: "blocked", reason: "Run is not executable in its current state.", run };
  const decision = evaluateAutomationPermission(action, policy);
  if (!decision.allowed) return { kind: "blocked", reason: decision.reason, run };
  if (decision.requiresApproval && !run.approval) {
    if (run.status !== "queued") return { kind: "blocked", reason: "Approval must be recorded before retry.", run };
    const next = transitionAutomationRun(run, "awaiting_approval", { now });
    return next.ok ? { kind: "approval", reason: decision.reason, run: next.run } : { kind: "blocked", reason: next.reason, run };
  }
  const next = transitionAutomationRun(run, "running", { now });
  return next.ok ? { kind: "execute", reason: "Authorized for execution; persist running state before external side effects.", run: next.run } : { kind: "blocked", reason: next.reason, run };
}
