import type { MoneyEntry } from "./types";

/** A contact with payout history must remain linked so historical closeouts stay reconcilable. */
export function hasRecordedPayouts(personId: string, entries: readonly MoneyEntry[]): boolean {
  return entries.some((entry) => entry.type === "payout" && entry.memberId === personId);
}
