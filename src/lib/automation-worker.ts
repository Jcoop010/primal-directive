import { retryDecision } from "./automation-policy.ts";
import { transitionAutomationRun, type AutomationRun } from "./automation-runner.ts";
import { planAutomationExecution } from "./automation-execution.ts";
import type { AutomationAction, AutomationPolicy } from "./automation-policy.ts";

/** Persistence contract: adapters must atomically claim idempotency keys and persist transitions. */
export interface AutomationRunStore {
  listByBand(bandId: string): Promise<AutomationRun[]>;
  save(run: AutomationRun): Promise<void>;
  claim(run: AutomationRun): Promise<boolean>;
}
export interface AutomationExecutor {
  execute(run: AutomationRun): Promise<void>;
}
export type AutomationTickResult = { status: "executed" | "retry" | "failed" | "approval" | "blocked" | "duplicate" | "wait"; run: AutomationRun; reason: string };

/** Process one bounded unit of work; never send or mutate a provider without a successful durable claim. */
export async function executeAutomationTick(input: {
  run: AutomationRun;
  action: AutomationAction;
  policy: AutomationPolicy;
  store: AutomationRunStore;
  executor: AutomationExecutor;
  now: string;
}): Promise<AutomationTickResult> {
  const { run, action, policy, store, executor, now } = input;
  const existingRuns = await store.listByBand(run.bandId);
  const plan = planAutomationExecution({ run, action, policy, now, existingRuns });
  if (plan.kind !== "execute") {
    if (plan.kind === "approval") await store.save(plan.run);
    return { status: plan.kind, run: plan.run, reason: plan.reason };
  }
  // Atomic claim is required across processes. A failed claim must not invoke the provider.
  if (!(await store.claim(plan.run))) return { status: "duplicate", run, reason: "Another worker claimed this run." };
  try {
    await executor.execute(plan.run);
    const done = transitionAutomationRun(plan.run, "succeeded", { now: new Date().toISOString() });
    if (!done.ok) throw new Error(done.reason);
    await store.save(done.run);
    return { status: "executed", run: done.run, reason: "Execution completed and recorded." };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const retry = retryDecision(plan.run.attempt, plan.run.maxAttempts);
    const next = transitionAutomationRun(plan.run, retry.retry ? "retry_scheduled" : "failed", {
      now: new Date().toISOString(),
      error: reason,
      ...(retry.retry ? { nextAttemptAt: new Date(Date.now() + retry.delayMs).toISOString() } : {}),
    });
    if (!next.ok) throw new Error(next.reason);
    await store.save({ ...next.run, lastError: reason });
    return { status: retry.retry ? "retry" : "failed", run: next.run, reason };
  }
}
