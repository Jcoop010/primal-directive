import { useMemo } from "react";
import { analyzeWorkspace } from "@/lib/workspace-intelligence";
import { useMusician } from "@/lib/store";
import { money } from "@/lib/format";

export function WorkspaceBrief() {
  const gigs = useMusician(state => state.gigs);
  const entries = useMusician(state => state.money);
  const merchProducts = useMusician(state => state.merchProducts);
  const tasks = useMusician(state => state.tasks);
  const brief = useMemo(() => analyzeWorkspace({ gigs, money: entries, merchProducts, tasks }), [gigs, entries, merchProducts, tasks]);
  return (
    <details className="rounded-lg border border-line bg-surface">
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Workspace brief · {brief.counts.openTasks} open tasks</summary>
      <div className="space-y-4 border-t border-line px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs text-muted">Recorded collected</p><p className="font-semibold tabular">{money(brief.ledgerCents.collected / 100, 2)}</p></div>
          <div><p className="text-xs text-muted">Collected minus costs</p><p className="font-semibold tabular">{money(brief.ledgerCents.operatingDifference / 100, 2)}</p></div>
          <div><p className="text-xs text-muted">After member payouts</p><p className="font-semibold tabular">{money(brief.ledgerCents.afterPayouts / 100, 2)}</p></div>
        </div>
        <p className="text-xs leading-relaxed text-muted">Calculated from {brief.counts.ledgerEntries} ledger entries and {brief.counts.gigs} shows. Outstanding income is excluded from collected money. Unrecorded costs are excluded; these are not verified bank balances.</p>
        {brief.priorities.length ? <ol className="space-y-3">{brief.priorities.map((priority, index) => <li key={priority.title} className="text-sm"><strong>{index + 1}. {priority.title}</strong><p className="mt-1 text-xs leading-relaxed text-muted">{priority.detail}</p></li>)}</ol> : <p className="text-sm text-muted">Add show, money, merchandise or task records to build a useful brief.</p>}
        {(brief.counts.unlinkedEntries > 0 || brief.counts.orphanedEntries > 0) && <p className="text-xs text-muted">{brief.counts.unlinkedEntries} ledger entries have no show link; {brief.counts.orphanedEntries} refer to a missing show. They count toward totals but are not assigned to a show's results.</p>}
        <p className="text-xs text-muted">Use Analyze workspace for the Advisor’s explanation and next steps. The brief itself does not make an AI request or change your records.</p>
      </div>
    </details>
  );
}
