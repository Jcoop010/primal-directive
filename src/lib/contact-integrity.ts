import type { MoneyEntry } from "./types";

/** A contact with payout history must remain linked so historical closeouts stay reconcilable. */
export function hasRecordedPayouts(personId: string, entries: readonly MoneyEntry[]): boolean {
  return entries.some((entry) => entry.type === "payout" && entry.memberId === personId);
}

/** Changing role or payout share after payment would rewrite historical allocations. */
export function changesPayoutIdentity(
  personId: string,
  current: { role: string; settlementSharePercent?: number },
  patch: { role?: string; settlementSharePercent?: number },
  entries: readonly MoneyEntry[],
): boolean {
  if (!hasRecordedPayouts(personId, entries)) return false;
  const roleChanged = patch.role !== undefined && patch.role !== current.role;
  const shareChanged = "settlementSharePercent" in patch
    && patch.settlementSharePercent !== current.settlementSharePercent;
  return roleChanged || shareChanged;
}
