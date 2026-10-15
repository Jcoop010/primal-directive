import { useMemo } from "react";
import { ArrowRight, CheckCircle2, CircleDollarSign, ListTodo, Sparkles, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { analyzeWorkspace } from "@/lib/workspace-intelligence";
import { useMusician } from "@/lib/store";
import { money } from "@/lib/format";

export function WorkspaceBrief() {
  const gigs = useMusician(state => state.gigs);
  const entries = useMusician(state => state.money);
  const merchProducts = useMusician(state => state.merchProducts);
  const tasks = useMusician(state => state.tasks);
  const brief = useMemo(() => analyzeWorkspace({ gigs, money: entries, merchProducts, tasks }), [gigs, entries, merchProducts, tasks]);
  const metrics = [
    { label: "Recorded collected", value: money(brief.ledgerCents.collected / 100, 2), icon: Wallet, accent: "text-live" },
    { label: "Collected minus costs", value: money(brief.ledgerCents.operatingDifference / 100, 2), icon: CircleDollarSign, accent: "text-accent" },
    { label: "After member payouts", value: money(brief.ledgerCents.afterPayouts / 100, 2), icon: CheckCircle2, accent: "text-live" },
    { label: "Open tasks", value: String(brief.counts.openTasks), icon: ListTodo, accent: "text-accent" },
  ];
  return (
    <section aria-label="Workspace command center" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent"><Sparkles className="size-3.5" /> Live workspace intelligence</div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">Your command center</h2>
          <p className="mt-1 text-xs text-muted">Real records. Clear priorities. No invented performance numbers.</p>
        </div>
        <Link to="/tasks" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-soft transition-colors hover:border-line-strong hover:text-fg">Manage tasks <ArrowRight className="size-3.5" /></Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {metrics.map(metric => <div key={metric.label} className="command-panel min-w-0 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-muted">{metric.label}</span><metric.icon className={`size-4 shrink-0 ${metric.accent}`} aria-hidden="true" /></div>
          <div className="mt-3 break-words text-lg font-bold tracking-tight text-fg tabular-nums sm:text-2xl">{metric.value}</div>
        </div>)}
      </div>
      <div className="command-panel overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h3 className="text-sm font-bold text-fg">Next best moves</h3>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">From your workspace</span>
        </div>
        {brief.priorities.length ? <ol className="divide-y divide-line">
          {brief.priorities.slice(0, 3).map((priority, index) => <li key={priority.title} className="flex gap-3 px-4 py-3.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-xs font-bold text-accent">{index + 1}</span>
            <div className="min-w-0"><h4 className="text-sm font-semibold text-fg">{priority.title}</h4><p className="mt-1 text-xs leading-relaxed text-muted">{priority.detail}</p></div>
          </li>)}
        </ol> : <p className="px-4 py-5 text-sm text-muted">Add shows, money, merchandise, or tasks to generate meaningful priorities.</p>}
        <details className="border-t border-line px-4 py-3 text-xs text-muted">
          <summary className="min-h-8 cursor-pointer font-semibold text-soft">Data quality & calculation notes</summary>
          <p className="mt-2 leading-relaxed">Based on {brief.counts.ledgerEntries} ledger entries and {brief.counts.gigs} shows. Outstanding income is excluded from collected money. Unrecorded costs are excluded. These are user-recorded figures, not verified bank balances.</p>
          {(brief.counts.unlinkedEntries > 0 || brief.counts.orphanedEntries > 0) && <p className="mt-2">{brief.counts.unlinkedEntries} ledger entries have no show link; {brief.counts.orphanedEntries} refer to a missing show. Both remain included in ledger totals.</p>}
          <p className="mt-2">This overview is calculated locally without an AI request or changes to your records.</p>
        </details>
      </div>
    </section>
  );
}
