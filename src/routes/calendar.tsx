import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { longDate, parseDay, toIsoDay } from "@/lib/format";
import { useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function CalendarPage() {
  const gigs = useMusician((s) => s.gigs);
  const openGig = useMusician((s) => s.openGig);
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
