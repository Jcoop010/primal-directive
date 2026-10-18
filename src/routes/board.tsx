import { BookingSummary } from "@/components/booking-summary";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, CircleAlert, ListChecks, Target, TrendingUp, ArrowRight } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { longDate, money, toIsoDay } from "@/lib/format";
import { deriveSignals } from "@/lib/signals";
import { buildDailyBriefing } from "@/lib/daily-briefing";
import { makeBriefingActionPrompt } from "@/lib/briefing-actions";
import { Sparkles, ArrowUpRight } from "lucide-react";
import {
  pipelineGigs,
  pipelineValue,
  sumMoney,
  useMusician,
  weightedValue,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/board")({ component: BoardPage });

export function BoardPage() {
  const gigs = useMusician((s) => s.gigs);
  const moneyEntries = useMusician((s) => s.money);
  const people = useMusician((s) => s.people);
  const tasks = useMusician((s) => s.tasks);
  const merchProducts = useMusician((s) => s.merchProducts);
  const collected = sumMoney(moneyEntries, "collected");
  const outstanding = sumMoney(moneyEntries, "outstanding");
  const costs = sumMoney(moneyEntries, "cost");
  const profit = collected - costs;
  const open = pipelineGigs(gigs);
  const bookingLeads = gigs.filter((gig) => ACTIVE_BOOKING_STATUSES.includes(gig.status)).map((gig) => {
    const hasSource = Boolean(gig.researchSourceUrl);
    const researchOnly = gig.notes.includes("Unconfirmed research lead");
    const hasDate = gig.date.length === 10 && gig.date[4] === "-" && gig.date[7] === "-";
    const score = Math.min(100, Math.round((gig.conf || 0) * 35 + (hasSource ? 25 : 0) + (gig.fee > 0 && !researchOnly ? 20 : 0) + (hasDate && !researchOnly ? 10 : 0) + (gig.status !== "lead" ? 10 : 0)));
    return { gig, score, hasSource, researchOnly };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
  const signals = deriveSignals(gigs, moneyEntries, people);
  const today = toIsoDay(new Date());
  const briefing = buildDailyBriefing({ gigs, tasks, money: moneyEntries, merchProducts }, today);
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
    typeof task.sourceKey === "string" && task.sourceKey.startsWith(`show:${nextShow.id}:`),
  ).length;
  const hasCompleteTaskPack = nextShowTaskPackCount >= 6;
  const nextShowTasks = nextShow
    ? openTasks
        .filter((task) => task.gigId === nextShow.id && task.dueDate <= nextShow.date)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    : [];
  const latestCompletedShow = gigs
    .filter((gig) => gig.status === "completed" && /^\d{4}-\d{2}-\d{2}$/.test(gig.date))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const settlementTask = latestCompletedShow
    ? tasks.find((task) => task.gigId === latestCompletedShow.id && task.sourceKey === `show:${latestCompletedShow.id}:reconcile:v1`)
    : undefined;
  const completedShowOutstanding = latestCompletedShow
    ? sumMoney(moneyEntries.filter((entry) => entry.gigId === latestCompletedShow.id), "outstanding")
    : 0;

  const upcomingBooked = gigs.filter((gig) => gig.status === "booked" && /^\d{4}-\d{2}-\d{2}$/.test(gig.date) && gig.date >= today).length;
  const completedTasks = tasks.filter((task) => task.status !== "open").length;
  const taskProgress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const topPriority = briefing[0];

  return (
    <div className="space-y-7">
      <section aria-label="Career command overview" className="command-surface relative isolate overflow-hidden rounded-[24px] px-5 py-7 sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 command-grid" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 command-glow" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,.6fr)] lg:items-center">
          <div>
            <div className="command-kicker flex items-center gap-2 text-live"><span className="size-2 rounded-full bg-live shadow-[0_0_12px_#55d49a]" /> LIVE WORKSPACE INTELLIGENCE</div>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">Your career.<br /><span className="text-accent">Under control.</span></h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-soft">One place to see your momentum, protect your revenue, and decide what deserves attention next. Every number below comes from your saved workspace.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/tasks" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-xs font-bold text-accent-fg transition-colors hover:bg-[#ff943f]"><Target className="size-4" /> Review priorities <ArrowRight className="size-4" /></Link>
              <Link to="/gigs" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-bg/70 px-5 text-xs font-bold text-fg hover:border-accent/50">Booking pipeline <ArrowUpRight className="size-4" /></Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line-strong bg-bg/65 p-4"><div className="command-kicker text-muted">Booked ahead</div><div className="mt-3 font-display text-4xl font-extrabold tabular text-live">{upcomingBooked}</div><div className="mt-1 text-xs text-muted">future confirmed shows</div></div>
            <div className="rounded-2xl border border-line-strong bg-bg/65 p-4"><div className="command-kicker text-muted">Open deals</div><div className="mt-3 font-display text-4xl font-extrabold tabular text-info">{open.length}</div><div className="mt-1 text-xs text-muted">active opportunities</div></div>
            <div className="col-span-2 rounded-2xl border border-line-strong bg-bg/65 p-4"><div className="flex items-end justify-between gap-3"><div><div className="command-kicker text-muted">Task completion</div><div className="mt-2 font-display text-3xl font-extrabold tabular">{taskProgress}%</div></div><TrendingUp className="size-5 text-accent" /></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${taskProgress}%` }} /></div><div className="mt-2 text-xs text-muted">{completedTasks} of {tasks.length} tracked tasks completed</div></div>
          </div>
        </div>
      </section>
      {topPriority ? <section aria-label="Top priority" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/[.07] px-5 py-4 sm:px-6"><div className="min-w-0"><div className="command-kicker flex items-center gap-2 text-accent"><Target className="size-4" /> YOUR NEXT BEST MOVE</div><h3 className="mt-2 font-display text-lg font-bold">{topPriority.title}</h3><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{topPriority.detail}</p></div><Link to={topPriority.href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 text-xs font-bold text-accent hover:bg-accent/20">Take action <ArrowRight className="size-4" /></Link></section> : null}
      <section aria-label="Mission Control daily briefing" className="command-surface relative isolate mb-8 overflow-hidden rounded-2xl p-5 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 command-grid" /><div aria-hidden="true" className="pointer-events-none absolute inset-0 command-glow" /><div className="relative flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent"><Sparkles className="size-4" /> DAILY MISSION BRIEF</div><h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Your action plan</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Prioritized from your saved bookings, tasks, finances, and inventory. Updated whenever your workspace changes.</p></div>
          <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-accent-fg">Ask AI Advisor <ArrowUpRight className="size-4" /></Link>
        </div>
        <div className="relative mt-7 grid gap-3 lg:grid-cols-2">
          {briefing.map((item) => <Link key={item.id} to={item.href} className="group flex items-start justify-between gap-3 rounded-xl border border-line bg-bg/80 p-4 transition-colors hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><div className="min-w-0"><div className="mb-2 flex items-center gap-2"><span className={cn("size-2 rounded-full", item.priority === "urgent" ? "bg-warn" : item.priority === "important" ? "bg-accent" : "bg-live")} /><span className="text-[10px] font-bold uppercase tracking-widest text-muted">{item.priority}</span></div><h3 className="text-sm font-bold">{item.title}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{item.detail}</p></div><ArrowUpRight className="size-4 shrink-0 text-muted group-hover:text-accent" /></Link>)}
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">{briefing.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => { window.sessionStorage.setItem("primal-briefing-prompt", makeBriefingActionPrompt(item)); window.location.assign("/"); }} className="min-h-10 rounded-lg border border-accent/40 bg-accent/10 px-3 text-xs font-bold text-accent hover:bg-accent/20">Plan: {item.title}</button>)}</div>
        <p className="relative mt-5 border-t border-line/70 pt-4 text-[11px] text-muted">Workspace intelligence · Rule-based, not externally verified AI research · No messages are sent automatically.</p>
      </section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Eyebrow>Overview / Booking board</Eyebrow><Link to="/gigs" className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-soft hover:border-accent hover:text-accent">View pipeline →</Link></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Collected" value={money(collected)} hint="cash logged" />
        <MetricCard label="Outstanding" value={money(outstanding)} hint="money to collect" />
        <MetricCard label="Open pipeline" value={money(pipelineValue(gigs))} hint={`${open.length} opportunities`} />
        <MetricCard label="Weighted" value={money(Math.round(weightedValue(gigs)))} hint="fee × confidence" />
      </div>
      <MetricCard
        className="mt-3"
        label="Real gig profit"
        value={money(profit)}
        hint={profit < 0 ? "loss after tracked costs" : "after tracked costs"}
      />

      <section aria-label="Booking intelligence" className="mt-6 mb-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><Eyebrow>Booking Intelligence</Eyebrow><h2 className="mt-2 font-display text-xl font-bold">Opportunity priorities</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">Transparent readiness ranking from your saved pipeline. Scores are heuristic, not predicted booking probability. Revenue and dates count only when entered as actual terms.</p></div>
          <Link to="/gigs" className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-soft hover:text-accent">Manage opportunities →</Link>
        </div>
        {bookingLeads.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-line p-4 text-sm text-muted">No active booking opportunities yet. Research venues with the AI Advisor, verify the sources, and save qualified leads to begin prioritizing.</p> : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {bookingLeads.map(({ gig, score }) => (
              <button type="button" key={gig.id} onClick={() => useMusician.getState().openGig(gig.id)} className="rounded-xl border border-line bg-bg p-4 text-left transition-colors hover:border-accent/50">
                <div className="mb-3 text-xs text-muted">Readiness estimate {score}/100 · review required</div>
                <BookingSummary gig={gig} today={today} />
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted">Score: confidence 35 pts, recorded research source 25, entered fee 20, entered date 10, progressed pipeline status 10. Does not validate sources, venue capacity, travel cost, or booking availability.</p>
      </section>
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

        {latestCompletedShow ? (
          <div className="mt-4 rounded-lg border border-line p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Latest completed show · settlement</div>
            <div className="mt-1 text-sm font-semibold">{latestCompletedShow.venue || latestCompletedShow.name}</div>
            <div className="mt-1 text-xs text-muted">{[latestCompletedShow.city, longDate(latestCompletedShow.date)].filter(Boolean).join(" · ")}</div>
            <div className="mt-3 flex items-start gap-2 text-xs">
              {!settlementTask ? (
                <>
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div>
                    <div className="font-semibold">Settlement checklist not found</div>
                    <p className="mt-1 leading-relaxed text-muted">Generate the missing show task pack before treating this show as reconciled.</p>
                  </div>
                </>
              ) : settlementTask.status === "open" ? (
                <>
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div>
                    <div className="font-semibold">Show reconciliation still open</div>
                    <p className="mt-1 leading-relaxed text-muted">
                      {completedShowOutstanding > 0
                        ? `${money(completedShowOutstanding)} is recorded as outstanding for this show.`
                        : "Verify actual income, costs, and merch results; no outstanding amount is currently recorded against this show."}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-live" />
                  <div>
                    <div className="font-semibold">Reconciliation task marked complete</div>
                    <p className="mt-1 leading-relaxed text-muted">
                      {completedShowOutstanding > 0
                        ? `${money(completedShowOutstanding)} is still recorded as outstanding; follow up on collection.`
                        : "Confirm all actual income, costs, and merch results were recorded before closing the books."}
                    </p>
                  </div>
                </>
              )}
            </div>
            {(!settlementTask || settlementTask.status === "open" || completedShowOutstanding > 0) && (
              <Link to="/tasks" className="mt-3 inline-flex min-h-9 items-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-fg">
                Review settlement tasks
              </Link>
            )}
          </div>
        ) : null}

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
          hash="advisor"
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
