import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { longDate, toIsoDay } from "@/lib/format";
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

  const monthDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: firstDay + daysInMonth }, (_, i) =>
      i < firstDay ? null : new Date(year, month, i - firstDay + 1),
    );
  }, [cursor]);

  const gigsByDay = useMemo(() => {
    const map = new Map<string, typeof gigs>();
    for (const gig of gigs) {
      const day = toIsoDay(gig.date);
      const list = map.get(day) ?? [];
      list.push(gig);
      map.set(day, list);
    }
    return map;
  }, [gigs]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    setCursor((current) =>
      new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Eyebrow>OPERATIONS</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg border p-2"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-32 text-center text-sm font-medium">{monthLabel}</div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg border p-2"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((day, index) => (
            <div key={`${day}-${index}`} className="p-2 text-center text-xs font-medium opacity-60">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthDays.map((day, index) => {
            const key = day ? toIsoDay(day) : `empty-${index}`;
            const dayGigs = day ? gigsByDay.get(key) ?? [] : [];
            return (
              <div key={key} className="min-h-24 border-b border-r p-2">
                {day && (
                  <>
                    <div className={cn("mb-2 text-xs", toIsoDay(new Date()) === key && "font-bold")}>{day.getDate()}</div>
                    <div className="space-y-1">
                      {dayGigs.map((gig) => (
                        <button
                          type="button"
                          key={gig.id}
                          onClick={() => openGig(gig.id)}
                          className="block w-full truncate rounded-md border p-1 text-left text-xs"
                          title={`${gig.name} — ${longDate(gig.date)}`}
                        >
                          <span className="font-medium">{gig.name}</span>
                          <StatusBadge status={gig.status} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {gigs.length === 0 && (
        <EmptyState
          title="No gigs on the calendar"
          body="Booked and scheduled gigs will appear here."
        />
      )}
    </div>
  );
}
