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
  const updateGig = useMusician((s) => s.updateGig);
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
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
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
            <div key={g.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => openGig(g.id)}
              className={cn(
                "flex w-full items-start justify-between gap-3 px-5 py-5 text-left transition-colors hover:bg-surface-2",
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
            <details className="px-5 pb-4 text-xs">
              <summary className="cursor-pointer text-accent">Research & outreach</summary>
              <p className="my-2 text-muted">{g.researchVerifiedAt ? "Source reviewed on " + g.researchVerifiedAt : "Research not independently verified. Do not assume contact, availability or booking terms are confirmed."}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>Contact<input aria-label="Booking contact" className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.outreachContact || ""} onChange={(e) => updateGig(g.id, {outreachContact:e.target.value})}/></label>
                <label>Follow-up date<input aria-label="Follow-up date" type="date" className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.outreachNextFollowUp || ""} onChange={(e) => updateGig(g.id, {outreachNextFollowUp:e.target.value})}/></label>
                <label>Last contacted<input aria-label="Last contacted" type="date" className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.outreachLastContactedAt || ""} onChange={(e) => updateGig(g.id, {outreachLastContactedAt:e.target.value})}/></label>
                <label>Research URL<input aria-label="Research URL" type="url" className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.researchSourceUrl || ""} onChange={(e) => updateGig(g.id, {researchSourceUrl:e.target.value,researchVerifiedAt:""})}/></label>
                <label className="sm:col-span-2">Outreach notes<textarea aria-label="Outreach notes" rows={2} className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.outreachNotes || ""} onChange={(e) => updateGig(g.id, {outreachNotes:e.target.value})}/></label>
                <button type="button" disabled={!g.researchSourceUrl} className="rounded border border-line px-3 py-2 disabled:opacity-40" onClick={() => updateGig(g.id, {researchVerifiedAt:new Date().toISOString().slice(0,10)})}>Mark source reviewed</button>
              </div>
              <p className="mt-2 text-muted">Manual record only; no messages are sent automatically.</p>
            </details>
            </div>
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
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}
