/** Parse a non-zero money-ledger amount while supporting cents and signed corrections. */
export function parseLedgerAmount(input: string): number | null {
  if (!input.trim()) return null;
  const amount = Number(input);
  return Number.isFinite(amount) && amount !== 0 ? amount : null;
}
