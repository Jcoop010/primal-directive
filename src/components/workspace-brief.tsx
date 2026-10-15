import { useMemo } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, Wallet, TrendingUp, Users } from "lucide-react";
import { analyzeWorkspace } from "@/lib/workspace-intelligence";
import { useMusician } from "@/lib/store";
import { money } from "@/lib/format";

export function WorkspaceBrief() {
  const gigs = useMusician(state => state.gigs);
  const entries = useMusician(state => state.money);
  const merchProducts = useMusician(state => state.merchProducts);
  const tasks = useMusician(state => state.tasks);
  const brief = useMemo(() => analyzeWorkspace({ gigs, money: entries, merchProducts, tasks }), [gigs, entries, merchProducts, tasks]);
  const stats = [
    { label: "Recorded collected", value: money(brief.ledgerCents.collected / 100, 2), icon: Wallet, tone: "text-live" },
    { label: "Collected minus costs", value: money(brief.ledgerCents.operatingDifference / 100, 2), icon: TrendingUp, tone: "text-accent" },
    { label: "After member payouts", value: money(brief.ledgerCents.afterPayouts / 100, 2), icon: Users, tone: "text-info" },
  ];
  return (
    <section aria-label="Artist command center" className="command-panel command-glow overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-live">Live workspace snapshot</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">Your command center</h2>
          <p className="mt-1 text-xs text-muted">What matters now, based on your saved records.</p>
        </div>
        <div className="flex min-h-10 items-center gap-2 rounded-full border border-line bg-bg/60 px-3 text-xs font-semibold text-soft">
          <CheckCircle2 aria-hidden="true" className="size-4 text-live" />
          {brief.counts.openTasks} open {brief.counts.openTasks === 1 ? "task" : "tasks"}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {stats.map(stat => (
          <div key={stat.label} className="command-stat min-w-0 p-3.5">
            <div className="flex items-center gap-2 text-xs text-muted"><stat.icon aria-hidden="true" className={`size-4 ${stat.tone}`} />{stat.label}</div>
            <div className="mt-2 break-words text-xl font-bold tracking-tight tabular sm:text-2xl">{stat.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Top priorities</h3>
          <span className="text-[11px] text-muted">From your workspace</span>
        </div>
        {brief.priorities.length ? (
          <ol className="grid gap-2 lg:grid-cols-2">
            {brief.priorities.slice(0, 2).map((priority, index) => (
              <li key={priority.title} className="flex gap-3 rounded-xl border border-line bg-bg/50 p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-live/10 text-xs font-bold text-live">{index + 1}</span>
                <div className="min-w-0">
                  <strong className="block text-sm">{priority.title}</strong>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{priority.detail}</p>
                </div>
                <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">Add gigs, finances, merchandise, or tasks to generate your first priorities.</p>
        )}
        <details className="group mt-3 rounded-lg border border-line bg-bg/40">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-xs font-semibold text-soft hover:text-fg">More priorities &amp; data notes</summary>
          <div className="space-y-3 border-t border-line p-3">
            {brief.priorities.slice(2).map(priority => <div key={priority.title}><strong className="text-xs">{priority.title}</strong><p className="mt-1 text-xs text-muted">{priority.detail}</p></div>)}
            <p className="text-xs leading-relaxed text-muted">Calculated from {brief.counts.ledgerEntries} recorded ledger entries and {brief.counts.gigs} shows. Outstanding income is excluded. Unrecorded costs are not included. These numbers are not verified bank balances.</p>
            {(brief.counts.unlinkedEntries > 0 || brief.counts.orphanedEntries > 0) && (
              <p className="flex gap-2 text-xs text-warn"><CircleAlert aria-hidden="true" className="size-4 shrink-0" />{brief.counts.unlinkedEntries} ledger entries have no show link; {brief.counts.orphanedEntries} refer to missing shows. They count in totals but cannot be assigned to a show.</p>
            )}
            <p className="text-xs text-muted">This snapshot is calculated locally from your records. It does not request AI or change any data.</p>
          </div>
        </details>
      </div>
    </section>
  );
}
