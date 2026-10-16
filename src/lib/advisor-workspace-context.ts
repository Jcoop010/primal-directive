/** Preserve the complete bounded workspace instead of silently dropping its tail. */
export function advisorWorkspaceContext(context: string): string {
  const max = 14000;
  if (context.length <= max) return context;
  return context.slice(0, max - 100).replace(/\n[^\n]*$/, "") +
    "\n[Workspace excerpt truncated; omitted records must not be assumed absent.]";
}
