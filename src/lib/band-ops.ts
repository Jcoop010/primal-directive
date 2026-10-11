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


export type SettlementMember = {
  id: string;
  name: string;
  sharePercent: number;
};

export type MemberPayout = {
  memberId: string;
  memberName: string;
  sharePercent: number;
  amount: number;
};

export type SettlementCalculation = {
  actualIncome: number;
  actualExpenses: number;
  actualNet: number;
  reservePercent: number;
  reserveAmount: number;
  distributableAmount: number;
  deficit: number;
  payouts: MemberPayout[];
};

/**
 * Calculates a proposed settlement from verified actuals only.
 * It does not initiate transfers or imply that a payout has been paid.
 * Payouts are rounded to cents using largest-remainder allocation so they
 * always add up exactly to the distributable amount.
 */
export function calculateSettlement(
  lines: readonly ShowFinancialLine[],
  members: readonly SettlementMember[],
  reservePercent = 0,
): SettlementCalculation {
  if (!Number.isFinite(reservePercent) || reservePercent < 0 || reservePercent > 100) {
    throw new Error("Reserve percent must be between 0 and 100.");
  }
  if (members.length === 0) throw new Error("At least one member is required.");
  const seenIds = new Set<string>();
  let shareTotal = 0;
  for (const member of members) {
    if (!member.id.trim() || !member.name.trim()) {
      throw new Error("Every member requires an ID and name.");
    }
    if (seenIds.has(member.id)) throw new Error("Member IDs must be unique.");
    seenIds.add(member.id);
    if (!Number.isFinite(member.sharePercent) || member.sharePercent < 0 || member.sharePercent > 100) {
      throw new Error(`Invalid split percentage for ${member.name}.`);
    }
    shareTotal += member.sharePercent;
  }
  if (Math.abs(shareTotal - 100) > 0.000001) {
    throw new Error("Member split percentages must total 100%.");
  }

  const actual = summarizeShowFinances(lines.filter((line) => line.status === "actual"));
  const toCents = (amount: number) => Math.round(amount * 100);
  const incomeCents = toCents(actual.actualIncome);
  const expenseCents = toCents(actual.actualExpenses);
  const netCents = incomeCents - expenseCents;
  const reserveCents = Math.round(Math.max(0, netCents) * reservePercent / 100);
  const distributableCents = Math.max(0, netCents - reserveCents);

  const shares = members.map((member, index) => {
    const exact = distributableCents * member.sharePercent / 100;
    return { member, index, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  const centsLeft = distributableCents - shares.reduce((sum, item) => sum + item.cents, 0);
  const priority = [...shares].sort((x, y) => y.remainder - x.remainder || x.index - y.index);
  for (let i = 0; i < centsLeft; i += 1) priority[i % priority.length]!.cents += 1;

  return {
    actualIncome: incomeCents / 100,
    actualExpenses: expenseCents / 100,
    actualNet: netCents / 100,
    reservePercent,
    reserveAmount: reserveCents / 100,
    distributableAmount: distributableCents / 100,
    deficit: Math.max(0, -netCents) / 100,
    payouts: shares.map(({ member, cents }) => ({
      memberId: member.id,
      memberName: member.name,
      sharePercent: member.sharePercent,
      amount: cents / 100,
    })),
  };
}
