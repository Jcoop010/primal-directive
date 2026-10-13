import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, CircleAlert, ListChecks } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { longDate, money, toIsoDay } from "@/lib/format";
import { deriveSignals } from "@/lib/signals";
import {
  pipelineGigs,
  pipelineValue,
  sumMoney,
  useMusician,
  weightedValue,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/board")({ component: BoardPage });

function BoardPage() {
  const gigs = useMusician((s) => s.gigs);
  const moneyEntries = useMusician((s) => s.money);
  const people = useMusician((s) => s.people);
  const tasks = useMusician((s) => s.tasks);
  const collected = sumMoney(moneyEntries, "collected");
  const outstanding = sumMoney(moneyEntries, "outstanding");
  const costs = sumMoney(moneyEntries, "cost");
  const profit = collected - costs;
  const open = pipelineGigs(gigs);
  const signals = deriveSignals(gigs, moneyEntries, people);
  const today = toIsoDay(new Date());
  const openTasks = tasks.filter((task) => task.status === "open");
  const overdueTasks = openTasks
    .filter((task) => task.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextShow = gigs
    .filter(
      (gig) =>
        gig.status === "booked" &&
        /^\d{4}-\d{2}-\d{2}$/.test(gig.date) &&
        gig.date >= today,
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextShowAllTasks = nextShow
    ? tasks.filter((task) => task.gigId === nextShow.id)
    : [];
  const nextShowTaskPackCount = nextShowAllTasks.filter((task) =>
    task.sourceKey.startsWith(`show:${nextShow?.id}:`),
  ).length;
  const hasCompleteTaskPack = nextShowTaskPackCount >= 6;
  const nextShowTasks = nextShow
    ? openTasks
        .filter((task) => task.gigId === nextShow.id && task.dueDate <= nextShow.date)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    : [];

  return (
    <div>
      <Eyebrow>Booking board</Eyebrow>
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Collected" value={money(collected)} hint="cash logged" />
        <MetricCard label="Outstanding" value={money(outstanding)} hint="money to collect" />
        <MetricCard label="Open pipeline" value={money(pipelineValue(gigs))} hint={`${open.length} opportunities`} />
        <MetricCard label="Weighted" value={money(Math.round(weightedValue(gigs)))} hint="fee × confidence" />
      </div>
      <MetricCard
        className="mt-2.5"
        label="Real gig profit"
        value={money(profit)}
        hint={profit < 0 ? "loss after tracked costs" : "after tracked costs"}
      />

      <Eyebrow>Band Pulse</Eyebrow>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">What needs attention</h2>
            <p className="mt-1 text-sm text-muted">
              A live snapshot calculated from your saved shows and tasks.
            </p>
          </div>
          <ListChecks className="size-5 shrink-0 text-accent" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Open tasks</div>
            <div className="mt-1 text-2xl font-bold tabular">{openTasks.length}</div>
          </div>
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Overdue</div>
            <div className={cn("mt-1 text-2xl font-bold tabular", overdueTasks.length > 0 && "text-warn")}>{overdueTasks.length}</div>
          </div>
        </div>

        {nextShow ? (
          <div className="mt-4 rounded-lg border border-line p-3">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Next booked show</div>
                <div className="mt-1 truncate text-sm font-semibold">{nextShow.venue || nextShow.name}</div>
                <div className="mt-1 text-xs text-muted">{[nextShow.city, longDate(nextShow.date)].filter(Boolean).join(" · ")}</div>
                {!hasCompleteTaskPack ? (
                  <div className="mt-3 rounded-md border border-dashed border-line p-3">
                    <div className="flex items-start gap-2 text-xs">
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                      <div>
                        <div className="font-semibold">Show checklist missing or incomplete</div>
                        <p className="mt-1 leading-relaxed text-muted">
                          {nextShowTaskPackCount === 0
                            ? "No generated checklist was found. The show is not confirmed ready just because no tasks appear here."
                            : `Only ${nextShowTaskPackCount} of the 6 standard workflow tasks were found.`}
                          {" "}Open Tasks and generate any missing steps.
                        </p>
                        <Link to="/tasks" className="mt-2 inline-flex min-h-9 items-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-fg">
                          Generate missing tasks
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    {nextShowTasks.length === 0 ? (
                      <>
                        <CheckCircle2 className="size-4 text-live" />
                        <span className="text-muted">All pre-show tasks due by show day are marked complete.</span>
                      </>
                    ) : (
                      <>
                        <CircleAlert className="size-4 text-warn" />
                        <span className="text-muted">{nextShowTasks.length} open preparation task{nextShowTasks.length === 1 ? "" : "s"} due by show day.</span>
                      </>
                    )}
                  </div>
                )}
                {nextShowTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="mt-2 flex items-start justify-between gap-3 border-t border-line pt-2 text-xs">
                    <span>{task.title}</span>
                    <span className="shrink-0 text-muted">{longDate(task.dueDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-line p-3 text-sm text-muted">
            No future booked show found. Confirm a dated gig to activate show-readiness tracking.
          </p>
        )}

        {overdueTasks.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold">Overdue actions</div>
            <div className="space-y-2">
              {overdueTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-3 text-xs">
                  <span>{task.title}</span>
                  <span className="shrink-0 text-warn">{longDate(task.dueDate)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <Link to="/tasks" className="mt-4 inline-flex min-h-10 items-center rounded-md bg-accent px-3.5 text-sm font-semibold text-accent-fg">
          Review tasks
        </Link>
      </Card>

      <Eyebrow>Signals</Eyebrow>
      <Card>
        <div className="space-y-3">
          {signals.map((s, i) => (
            <Link
              key={s.id}
              to={s.href ?? "/board"}
              className={cn("block", i < signals.length - 1 && "border-b border-line pb-3")}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    s.tone === "live" && "bg-live",
                    s.tone === "warn" && "bg-warn",
                    s.tone === "info" && "bg-info",
                  )}
                />
                <div className="text-sm font-semibold">{s.title}</div>
              </div>
              <p className="mt-1 pl-3.5 text-xs leading-relaxed text-muted">{s.detail}</p>
            </Link>
          ))}
        </div>
      </Card>

      <Eyebrow>AI next move</Eyebrow>
      <Card>
        <h2 className="font-display text-lg font-semibold">Turn live web signals into a pursuit list</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Ask the advisor for rooms, bills, and routing that fit this draw — then push winners into the pipeline.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          Open advisor
        </Link>
      </Card>

      <Eyebrow>Pipeline snapshot</Eyebrow>
      <Card className="p-0">
        {open.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No open gigs. Add an opportunity or ask the advisor.</p>
        ) : (
          open.slice(0, 5).map((g, i) => (
            <div
              key={g.id}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3.5",
                i < Math.min(open.length, 5) - 1 && "border-b border-line",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{g.venue || g.name}</div>
                <div className="text-xs text-muted">{g.city}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular">{money(g.fee)}</span>
                <StatusBadge status={g.status} />
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
