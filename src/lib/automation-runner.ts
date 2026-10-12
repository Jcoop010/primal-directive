export type AutomationRunStatus = "queued" | "awaiting_approval" | "running" | "retry_scheduled" | "succeeded" | "failed" | "cancelled";

export type AutomationRun = {
  id: string;
  bandId: string;
  action: string;
  idempotencyKey: string;
  status: AutomationRunStatus;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string;
  lastError?: string;
  approval?: { approvedBy: string; approvedAt: string };
};

const terminal = new Set<AutomationRunStatus>(["succeeded", "failed", "cancelled"]);
const transitions: Record<AutomationRunStatus, ReadonlySet<AutomationRunStatus>> = {
  queued: new Set(["awaiting_approval", "running", "cancelled"]),
  awaiting_approval: new Set(["queued", "cancelled"]),
  running: new Set(["succeeded", "retry_scheduled", "failed", "cancelled"]),
  retry_scheduled: new Set(["running", "failed", "cancelled"]),
  succeeded: new Set(), failed: new Set(), cancelled: new Set(),
};
const nonEmpty = (value: string) => typeof value === "string" && value.trim().length > 0;

export function createAutomationRun(input: { id: string; bandId: string; action: string; idempotencyKey: string; now: string; maxAttempts?: number }): AutomationRun {
  for (const [field, value] of Object.entries(input)) {
    if (field === "maxAttempts") continue;
    if (typeof value !== "string" || !nonEmpty(value)) throw new Error(field + " must be a non-empty string.");
  }
  if (!Number.isFinite(Date.parse(input.now))) throw new Error("now must be a valid date.");
  const maxAttempts = input.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error("maxAttempts must be a positive integer.");
  return { id: input.id, bandId: input.bandId, action: input.action, idempotencyKey: input.idempotencyKey, status: "queued", attempt: 0, maxAttempts, createdAt: input.now, updatedAt: input.now };
}

export function transitionAutomationRun(run: AutomationRun, nextStatus: AutomationRunStatus, options: { now: string; error?: string; nextAttemptAt?: string; approvedBy?: string }): { ok: true; run: AutomationRun } | { ok: false; reason: string } {
  if (!nonEmpty(run.id) || !nonEmpty(run.bandId) || !nonEmpty(run.idempotencyKey)) return { ok: false, reason: "Run identity, band scope, and idempotency key are required." };
  if (!Number.isFinite(Date.parse(options.now))) return { ok: false, reason: "Transition time must be a valid date." };
  if (terminal.has(run.status)) return { ok: false, reason: "Run is terminal and cannot transition." };
  if (!transitions[run.status].has(nextStatus)) return { ok: false, reason: "Transition from " + run.status + " to " + nextStatus + " is not allowed." };
  if (nextStatus === "running" && run.attempt >= run.maxAttempts) return { ok: false, reason: "Maximum attempts reached." };
  if (nextStatus === "retry_scheduled" && (!options.nextAttemptAt || !Number.isFinite(Date.parse(options.nextAttemptAt)))) return { ok: false, reason: "A retry requires a valid nextAttemptAt." };
  if (nextStatus === "failed" && run.status === "running" && !nonEmpty(options.error ?? "")) return { ok: false, reason: "A failed execution must include an error summary." };
  if (run.status === "awaiting_approval" && nextStatus === "queued" && !nonEmpty(options.approvedBy ?? "")) return { ok: false, reason: "Approval identity is required before resuming." };
  const updated: AutomationRun = { ...run, status: nextStatus, updatedAt: options.now };
  if (nextStatus === "running") { updated.attempt = run.attempt + 1; delete updated.nextAttemptAt; }
  if (nextStatus === "retry_scheduled") updated.nextAttemptAt = options.nextAttemptAt;
  if (nextStatus === "failed" && options.error) updated.lastError = options.error;
  if (run.status === "awaiting_approval" && nextStatus === "queued") updated.approval = { approvedBy: options.approvedBy!, approvedAt: options.now };
  return { ok: true, run: updated };
}

export function isTerminalAutomationRun(status: AutomationRunStatus): boolean { return terminal.has(status); }
