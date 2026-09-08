import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Eyebrow } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { downloadCsv, longDate, money } from "@/lib/format";
import { pipelineValue, useMusician } from "@/lib/store";
import {
  GIG_STATUS_LABEL,
  GIG_STATUSES,
  type GigStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gigs")({ component: GigsPage });

function GigsPage() {
  const gigs = useMusician((s) => s.gigs);
  const openGig = useMusician((s) => s.openGig);
  const [filter, setFilter] = useState<"all" | GigStatus>("all");
  const shown =
    filter === "all" ? gigs : gigs.filter((g) => g.status === filter);

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <Eyebrow>Gig pipeline</Eyebrow>
        <button
          type="button"
          className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg"
          onClick={() =>
            downloadCsv("gigs.csv", [
              ["name", "venue", "city", "date", "fee", "confidence", "status", "notes"],
              ...gigs.map((g) => [
                g.name,
                g.venue,
                g.city,
                g.date,
                String(g.fee),
                String(g.conf),
                g.status,
                g.notes,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </div>
      <p className="mb-3 px-1 text-xs text-muted">
        {money(pipelineValue(gigs))} open · {gigs.length} total
      </p>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
        />
        {GIG_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={GIG_STATUS_LABEL[s]}
          />
        ))}
      </div>
      <Card className="p-0">
        {shown.length === 0 ? (
          <EmptyState
            title="No gigs yet"
            body="Use the advisor to surface rooms, or add an opportunity yourself."
            action="Add gig"
            onAction={() => openGig()}
          />
        ) : (
          shown.map((g, i) => (
            <button
              key={g.id}
              type="button"
              onClick={() => openGig(g.id)}
              className={cn(
                "flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2",
                i < shown.length - 1 && "border-b border-line",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {g.venue || g.name}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {g.name}
                  {g.city ? ` · ${g.city}` : ""}
                </div>
                <div className="mt-2">
                  <StatusBadge status={g.status} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular">{money(g.fee)}</div>
                <div className="text-xs text-muted">{longDate(g.date)}</div>
                <div className="text-[11px] text-muted">
                  {Math.round(g.conf * 100)}% conf
                </div>
              </div>
            </button>
          ))
        )}
      </Card>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        active
          ? "border-line-strong bg-surface-2 text-fg"
          : "border-line bg-bg text-muted",
      )}
    >
      {label}
    </button>
  );
}
