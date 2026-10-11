export const SHOW_LIFECYCLE = [
  "lead",
  "researched",
  "qualified",
  "outreach_ready",
  "contacted",
  "negotiating",
  "hold",
  "contracted",
  "confirmed",
  "advancing",
  "performed",
  "settling",
  "settled",
  "lost",
  "cancelled",
  "postponed",
  "disputed",
] as const;

export type ShowLifecycleStatus = (typeof SHOW_LIFECYCLE)[number];

const NEXT: Record<ShowLifecycleStatus, readonly ShowLifecycleStatus[]> = {
  lead: ["researched", "lost"],
  researched: ["qualified", "lost"],
  qualified: ["outreach_ready", "lost"],
  outreach_ready: ["contacted", "lost"],
  contacted: ["negotiating", "hold", "lost"],
  negotiating: ["hold", "contracted", "lost"],
  hold: ["negotiating", "contracted", "confirmed", "lost", "cancelled"],
  contracted: ["confirmed", "cancelled", "disputed"],
  confirmed: ["advancing", "cancelled", "postponed", "disputed"],
  advancing: ["performed", "cancelled", "postponed", "disputed"],
  performed: ["settling", "disputed"],
  settling: ["settled", "disputed"],
  settled: [],
  lost: [],
  cancelled: [],
  postponed: ["confirmed", "cancelled", "lost"],
  disputed: ["settling", "settled", "cancelled"],
};

export type TransitionCheck =
  | { ok: true; from: ShowLifecycleStatus; to: ShowLifecycleStatus }
  | { ok: false; reason: string };

export function canTransitionShow(
  from: ShowLifecycleStatus,
  to: ShowLifecycleStatus,
): TransitionCheck {
  if (from === to) {
    return { ok: false, reason: "Show is already in this status." };
  }
  if (!NEXT[from].includes(to)) {
    return {
      ok: false,
      reason: `Invalid show transition: ${from} -> ${to}.`,
    };
  }
  return { ok: true, from, to };
}

export type ShowFinancialLine = {
  label: string;
  amount: number;
  kind: "income" | "expense";
  status: "expected" | "actual";
};

export type ShowFinancialSummary = {
  expectedIncome: number;
  actualIncome: number;
  expectedExpenses: number;
  actualExpenses: number;
  expectedNet: number;
  actualNet: number;
  unverifiedLines: number;
};

export function summarizeShowFinances(
  lines: readonly ShowFinancialLine[],
): ShowFinancialSummary {
  let expectedIncome = 0;
  let actualIncome = 0;
  let expectedExpenses = 0;
  let actualExpenses = 0;
  let unverifiedLines = 0;

  for (const line of lines) {
    if (!Number.isFinite(line.amount) || line.amount < 0) {
      throw new Error(`Invalid amount for "${line.label}". Amounts must be finite and non-negative.`);
    }
    if (line.status === "expected") {
      unverifiedLines += 1;
      if (line.kind === "income") expectedIncome += line.amount;
      else expectedExpenses += line.amount;
    } else if (line.kind === "income") {
      actualIncome += line.amount;
    } else {
      actualExpenses += line.amount;
    }
  }

  return {
    expectedIncome,
    actualIncome,
    expectedExpenses,
    actualExpenses,
    expectedNet: expectedIncome - expectedExpenses,
    actualNet: actualIncome - actualExpenses,
    unverifiedLines,
  };
}

/** Stable key for de-duplicating a show-triggered workflow; use normalized values. */
export function showWorkflowKey(
  showId: string,
  workflowName: string,
  version = 1,
): string {
  const id = showId.trim();
  const workflow = workflowName.trim().toLowerCase();
  if (!id || !workflow) throw new Error("Show ID and workflow name are required.");
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Workflow version must be a positive integer.");
  }
  return `show:${id}:workflow:${workflow}:v${version}`;
}
