import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Route as RouteIcon, Calculator } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { longDate, toIsoDay, money } from "@/lib/format";
import { useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function CalendarPage() {
  const gigs = useMusician((s) => s.gigs);
  const openGig = useMusician((s) => s.openGig);
  const [tourStart, setTourStart] = useState("");
  const [tourEnd, setTourEnd] = useState("");
  const [miles, setMiles] = useState(0);
  const [costPerMile, setCostPerMile] = useState(0.35);
  const [lodging, setLodging] = useState(0);
  const [dailyExpenses, setDailyExpenses] = useState(0);
  const [extraCosts, setExtraCosts] = useState(0);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof gigs>();
    for (const g of gigs) {
      if (!g.date) continue;
      const list = map.get(g.date) ?? [];
      list.push(g);
      map.set(g.date, list);
    }
    return map;
  }, [gigs]);

  const cells = useMemo(() => buildCells(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedGigs = selected ? (byDay.get(selected) ?? []) : [];
  const upcoming = [...gigs]
    .filter((g) => g.date && g.status !== "passed")
    .sort((a, b) => a.date.localeCompare(b.date));

  const planned = gigs.filter((g) => ["booked", "hold", "negotiating"].includes(g.status) && /^\\d{4}-\\d{2}-\\d{2}$/.test(g.date) && (!tourStart || g.date >= tourStart) && (!tourEnd || g.date <= tourEnd)).sort((a,b) => a.date.localeCompare(b.date));
  const booked = planned.filter((g) => g.status === "booked");
  const days = tourStart && tourEnd && tourEnd >= tourStart ? Math.round((Date.parse(tourEnd + "T12:00:00Z") - Date.parse(tourStart + "T12:00:00Z")) / 86400000) + 1 : 0;
  const estimatedCosts = Math.max(0, miles) * Math.max(0, costPerMile) + Math.max(0, lodging) + Math.max(0, dailyExpenses) * days + Math.max(0, extraCosts);
  const confirmedFees = booked.reduce((sum, gig) => sum + Math.max(0, gig.fee || 0), 0);
  const unpriced = booked.filter((gig) => !gig.fee).length;
  const estimate = confirmedFees - estimatedCosts;

  return (
    <div>
      <Eyebrow>Calendar</Eyebrow>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-md border border-line hover:bg-surface-2"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="font-display text-lg font-semibold">{monthLabel}</div>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-md border border-line hover:bg-surface-2"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-[0.12em] text-muted">
          {WEEKDAYS.map((d, i) => (
            <div key={`${d}-${i}`} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`pad-${i}`} />;
            const iso = toIsoDay(cell);
            const items = byDay.get(iso) ?? [];
            const isToday = iso === toIsoDay(new Date());
            const isSel = selected === iso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-md text-sm",
                  isSel && "bg-accent text-accent-fg",
                  !isSel && isToday && "border border-accent/60",
                  !isSel && !isToday && "hover:bg-surface-2",
                )}
              >
                {cell.getDate()}
                {items.length > 0 ? (
                  <span
                    className={cn(
                      "mt-0.5 size-1 rounded-full",
                      isSel ? "bg-accent-fg" : "bg-accent",
                    )}
                  />
                ) : (
                  <span className="mt-0.5 size-1" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Eyebrow>Tour Intelligence</Eyebrow>
      <Card className="command-surface">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><RouteIcon className="size-5 text-accent" /><h2 className="font-display text-xl font-bold">Tour budget simulator</h2></div><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Build a financial scenario from dated bookings and your own travel assumptions. Nothing here changes your saved ledger or creates bookings.</p></div><span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">Scenario only</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-soft">Start date<input aria-label="Tour start date" type="date" value={tourStart} onChange={(e) => setTourStart(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-fg" /></label>
          <label className="text-xs font-semibold text-soft">End date<input aria-label="Tour end date" type="date" min={tourStart || undefined} value={tourEnd} onChange={(e) => setTourEnd(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-fg" /></label>
          <label className="text-xs font-semibold text-soft">Estimated route miles<input aria-label="Estimated route miles" type="number" min="0" step="1" value={miles} onChange={(e) => setMiles(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-fg" /></label>
          <label className="text-xs font-semibold text-soft">Vehicle cost per mile ($)<input aria-label="Vehicle cost per mile" type="number" min="0" step="0.01" value={costPerMile} onChange={(e) => setCostPerMile(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-fg" /></label>
          <label className="text-xs font-semibold text-soft">Total lodging ($)<input aria-label="Total lodging" type="number" min="0" step="1" value={lodging} onChange={(e) => setLodging(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-fg" /></label>
          <label className="text-xs font-semibold text-soft">Daily meals / per diem ($)<input aria-label="Daily expenses" type="number" min="0" step="1" value={dailyExpenses} onChange={(e) => setDailyExpenses(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-fg" /></label>
          <label className="text-xs font-semibold text-soft">Other tour costs ($)<input aria-label="Other tour costs" type="number" min="0" step="1" value={extraCosts} onChange={(e) => setExtraCosts(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-fg" /></label>
          <div className="rounded-lg border border-line bg-bg p-3"><div className="command-kicker text-muted">Tour duration</div><div className="mt-3 font-display text-2xl font-bold">{days ? `${days} days` : "Choose dates"}</div><p className="mt-1 text-[11px] text-muted">Per diem applies only when both dates are set</p></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-line bg-bg/70 p-4"><div className="command-kicker text-muted">Entered booked fees</div><div className="mt-2 font-display text-2xl font-extrabold tabular text-live">{money(confirmedFees)}</div><p className="mt-1 text-xs text-muted">{booked.length} booked show{booked.length === 1 ? "" : "s"} in scenario</p></div><div className="rounded-xl border border-line bg-bg/70 p-4"><div className="command-kicker text-muted">Estimated tour costs</div><div className="mt-2 font-display text-2xl font-extrabold tabular">{money(estimatedCosts)}</div><p className="mt-1 text-xs text-muted">Based on your inputs</p></div><div className="rounded-xl border border-accent/30 bg-accent/[.06] p-4"><div className="flex items-center gap-2 command-kicker text-accent"><Calculator className="size-4" /> Scenario margin</div><div className="mt-2 font-display text-2xl font-extrabold tabular">{money(estimate)}</div><p className="mt-1 text-xs text-muted">Entered fees minus estimated costs</p></div></div>
        {unpriced > 0 ? <p className="mt-3 rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">{unpriced} booked show{unpriced === 1 ? "" : "s"} have no entered fee. This scenario is incomplete and may understate income.</p> : null}
        {(!tourStart || !tourEnd) ? <p className="mt-3 text-xs text-muted">Select both dates to calculate daily expenses and narrow the tour window. Until then, all dated booked and proposed shows are included.</p> : null}
        <div className="mt-5 space-y-2">{planned.length ? planned.map((gig) => <button key={gig.id} type="button" onClick={() => openGig(gig.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line bg-bg/60 px-4 py-3 text-left hover:border-accent/50"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{gig.venue || gig.name}</span><span className="mt-1 block text-xs text-muted">{gig.city || "City unknown"} · {longDate(gig.date)}</span></span><span className="shrink-0 text-right"><span className="block text-xs font-bold">{gig.status}</span><span className="mt-1 block text-xs text-muted">{gig.status === "booked" && gig.fee > 0 ? money(gig.fee) : "Not counted as booked income"}</span></span></button>) : <p className="rounded-lg border border-dashed border-line p-4 text-xs text-muted">No dated booked, held, or negotiating shows match this date range.</p>}</div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted">Route miles are manually entered, not map-calculated. Holds and negotiations appear for planning but are excluded from booked fee totals. Entered fees are not guaranteed collections. The estimate excludes unentered expenses, taxes, merch, and settlement adjustments.</p>
      </Card>
      <Eyebrow>{selected ? longDate(selected) : "Upcoming"}</Eyebrow>
      <Card className="p-0">
        {(selected ? selectedGigs : upcoming).length === 0 ? (
          <EmptyState
            title={selected ? "Nothing this day" : "Nothing scheduled"}
            body="Add a dated gig from the pipeline or ask the advisor for a routing cluster."
            action="Add gig"
            onAction={() => openGig()}
          />
        ) : (
          (selected ? selectedGigs : upcoming).map((g, i, arr) => (
            <button
              key={g.id}
              type="button"
              onClick={() => openGig(g.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2",
                i < arr.length - 1 && "border-b border-line",
              )}
            >
              <div>
                <div className="text-sm font-semibold">{g.venue || g.name}</div>
                <div className="text-xs text-muted">
                  {g.city}
                  {!selected ? ` · ${longDate(g.date)}` : ""}
                </div>
              </div>
              <StatusBadge status={g.status} />
            </button>
          ))
        )}
      </Card>
    </div>
  );
}

function buildCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = first.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  return cells;
}
