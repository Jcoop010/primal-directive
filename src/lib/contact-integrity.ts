import type { MoneyEntry } from "./types";

/** A contact with payout history must remain linked so historical closeouts stay reconcilable. */
export function hasRecordedPayouts(personId: string, entries: readonly MoneyEntry[]): boolean {
  return entries.some((entry) => entry.type === "payout" && entry.memberId === personId);
}


/** Keep a show linked while any financial or merch history depends on it. */
export function hasGigLinkedFinancialHistory(
  gigId: string,
  entries: readonly MoneyEntry[],
  sales: readonly { gigId?: string }[],
  orders: readonly { gigId?: string }[],
  adjustments: readonly { gigId?: string }[],
): boolean {
  if (!gigId.trim()) return false;
  return entries.some((entry) => entry.gigId === gigId)
    || sales.some((sale) => sale.gigId === gigId)
    || orders.some((order) => order.gigId === gigId)
    || adjustments.some((adjustment) => adjustment.gigId === gigId);
}
