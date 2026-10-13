import type { MoneyEntry, Person } from "./types";

export type SettlementLine = { memberId: string; memberName: string; sharePercent: number | undefined; amountDue: number; amountPaid: number; remaining: number; overpaid: number };
export type SettlementSummary = { collected: number; operatingCosts: number; netPool: number; shareTotal: number; sharesValid: boolean; missingShareNames: string[]; lines: SettlementLine[]; totalPaid: number; totalRemaining: number };
function cents(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

/** Validate and round a partial member payout against the remaining allocation. */
export function parsePayoutAmount(input: string, remaining: number): number | null {
  if (!input.trim() || !Number.isFinite(remaining) || remaining <= 0) return null;
  const raw = Number(input);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const amount = cents(raw);
  return amount > 0 && amount <= remaining ? amount : null;
}

/** New contacts use the explicit member role; retain legacy band contacts only when a payout share was deliberately configured. */
export function isPayoutMember(person: Pick<Person, "role" | "settlementSharePercent">): boolean {
  return person.role === "member" || (person.role === "band" && person.settlementSharePercent !== undefined);
}

/** Cash-based show settlement. Only linked collected income and operating costs enter the pool. */
export function calculateSettlement(gigId: string, bandMembers: readonly Person[], entries: readonly MoneyEntry[]): SettlementSummary {
  const linked = entries.filter((entry) => entry.gigId === gigId);
  const collected = cents(linked.filter((entry) => entry.type === "collected").reduce((sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0), 0));
  const operatingCosts = cents(linked.filter((entry) => entry.type === "cost").reduce((sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0), 0));
  const netPool = cents(Math.max(0, collected - operatingCosts));
  const shareTotal = cents(bandMembers.reduce((sum, person) => sum + (person.settlementSharePercent ?? 0), 0));
  const missingShareNames = bandMembers.filter((person) => person.settlementSharePercent === undefined || !Number.isFinite(person.settlementSharePercent)).map((person) => person.name);
  const sharesValid = bandMembers.length > 0 && missingShareNames.length === 0 && bandMembers.every((person) => person.settlementSharePercent! >= 0 && person.settlementSharePercent! <= 100) && Math.abs(shareTotal - 100) < 0.011;
  let allocated = 0;
  const lines = bandMembers.map((person, index): SettlementLine => {
    const share = person.settlementSharePercent;
    let amountDue = 0;
    if (sharesValid && share !== undefined) {
      amountDue = index === bandMembers.length - 1 ? cents(netPool - allocated) : cents(netPool * share / 100);
      allocated = cents(allocated + amountDue);
    }
    const amountPaid = cents(linked.filter((entry) => entry.type === "payout" && entry.memberId === person.id).reduce((sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0), 0));
    const remaining = cents(Math.max(0, amountDue - amountPaid));
    const overpaid = cents(Math.max(0, amountPaid - amountDue));
    return { memberId: person.id, memberName: person.name, sharePercent: share, amountDue, amountPaid, remaining, overpaid };
  });
  return { collected, operatingCosts, netPool, shareTotal, sharesValid, missingShareNames, lines, totalPaid: cents(lines.reduce((sum, line) => sum + line.amountPaid, 0)), totalRemaining: cents(lines.reduce((sum, line) => sum + line.remaining, 0)) };
}
