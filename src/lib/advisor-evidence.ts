export function evidenceSupportedLeads<T extends { reason: string }>(
  leads: T[],
  citations: string[],
): T[] {
  // A generic provider citation is not proof for a specific lead.
  // Require each lead to name at least one exact retrieved URL in its evidence.
  return leads.filter((lead) => citations.some((url) => lead.reason.includes(url)));
}
