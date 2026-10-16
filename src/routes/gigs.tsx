import { useState } from "react";
import { LayoutGrid, List, ArrowUpRight, Search, CalendarClock } from "lucide-react";
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
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const active = gigs.filter((g) => ["lead", "outreach", "negotiating", "hold"].includes(g.status));
  const due = active.filter((g) => g.outreachNextFollowUp && g.outreachNextFollowUp <= today);
  const sourced = active.filter((g) => Boolean(g.researchSourceUrl));
  const filtered = filter === "all" ? gigs : gigs.filter((g) => g.status === filter);
  const shown = filtered.filter((g) => [g.name, g.venue, g.city, g.outreachContact].join(" ").toLowerCase().includes(query.trim().toLowerCase()));

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-display text-xl font-bold">Opportunity workspace</div><p className="mt-1 text-xs text-muted">Research leads are not confirmed bookings. Select a card to review or update it.</p></div>
        <div className="inline-flex rounded-xl border border-line-strong bg-surface p-1" aria-label="Booking display mode">
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold", view === "board" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}><LayoutGrid className="size-4" /> Board</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold", view === "list" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}><List className="size-4" /> List</button>
        </div>
      </div>
      <section aria-label="Booking pipeline health" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="command-surface rounded-xl p-4"><div className="command-kicker text-muted">Active leads</div><div className="mt-2 font-display text-3xl font-extrabold tabular text-info">{active.length}</div><p className="mt-1 text-xs text-muted">Not confirmed bookings</p></div>
        <div className="command-surface rounded-xl p-4"><div className="command-kicker text-muted">Follow-ups due</div><div className="mt-2 font-display text-3xl font-extrabold tabular text-accent">{due.length}</div><p className="mt-1 text-xs text-muted">Due today or overdue</p></div>
        <div className="command-surface rounded-xl p-4"><div className="command-kicker text-muted">Source recorded</div><div className="mt-2 font-display text-3xl font-extrabold tabular">{sourced.length}<span className="text-sm text-muted"> / {active.length}</span></div><p className="mt-1 text-xs text-muted">Source recorded ≠ verified</p></div>
        <div className="command-surface rounded-xl p-4"><div className="command-kicker text-muted">Open pipeline</div><div className="mt-2 font-display text-2xl font-extrabold tabular text-live">{money(pipelineValue(gigs))}</div><p className="mt-1 text-xs text-muted">Unconfirmed opportunity value</p></div>
      </section>
      <label className="mb-4 flex min-h-11 items-center gap-3 rounded-xl border border-line-strong bg-surface px-4 text-sm text-muted"><Search className="size-4 shrink-0" /><span className="sr-only">Search bookings</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search venue, city, opportunity, or contact…" className="min-w-0 w-full bg-transparent text-fg outline-none placeholder:text-muted" /></label>
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
      <Card className="command-surface mb-5 p-5 sm:p-6">
        <div className="flex items-center gap-2 font-display text-lg font-bold"><CalendarClock className="size-5 text-accent" /> Upcoming booking follow-ups</div>
        <p className="mt-1 text-xs text-muted">Scheduled reminders only; no emails or messages are sent automatically.</p>
        {gigs.filter((g) => g.outreachNextFollowUp && ["lead","outreach","negotiating","hold"].includes(g.status)).sort((a,b) => (a.outreachNextFollowUp || "").localeCompare(b.outreachNextFollowUp || "")).slice(0,6).map((g) => (
          <button key={g.id} type="button" onClick={() => openGig(g.id)} className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-bg/70 px-4 py-3 text-left text-xs transition-colors hover:border-accent/50 hover:bg-surface-2">
            <span>{g.venue || g.name}</span><span>{g.outreachNextFollowUp}</span>
          </button>
        ))}
      </Card>
      {view === "board" ? (
        <section aria-label="Booking pipeline board" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {GIG_STATUSES.map((status) => {
            const items = shown.filter((gig) => gig.status === status);
            return <div key={status} className="command-surface min-w-0 rounded-2xl p-3">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-3"><h2 className="text-xs font-bold uppercase tracking-wider text-soft">{GIG_STATUS_LABEL[status]}</h2><span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-bold tabular text-muted">{items.length}</span></div>
              <div className="space-y-2">
                {items.map((gig) => <button key={gig.id} type="button" onClick={() => openGig(gig.id)} className="w-full rounded-xl border border-line bg-bg/80 p-3 text-left transition-colors hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-bold">{gig.venue || gig.name}</div><div className="mt-1 text-xs text-muted">{gig.city || "Location not entered"}</div></div><ArrowUpRight className="size-4 shrink-0 text-muted" /></div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold tabular">{gig.fee > 0 ? money(gig.fee) : "Fee unconfirmed"}</span><span className="text-[10px] text-muted">{gig.date ? longDate(gig.date) : "Date unconfirmed"}</span></div>
                  <div className="mt-2 border-t border-line pt-2 text-[10px] font-semibold">{gig.researchVerifiedAt ? <span className="text-live">Source reviewed · not booking confirmation</span> : <span className="text-warn">Research unverified</span>}</div>
                  {gig.outreachNextFollowUp ? <div className="mt-1 text-[10px] text-info">Follow up: {gig.outreachNextFollowUp}</div> : null}
                </button>)}
                {items.length === 0 ? <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">No opportunities</div> : null}
              </div>
            </div>;
          })}
        </section>
      ) : <Card className="command-surface overflow-hidden p-0">
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
              <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3">
                <div className="font-semibold text-fg">Booking outreach assistant</div>
                <p className="mt-1 text-muted">Create a reviewable first-contact draft from your saved lead. Confirm venue details and the recipient before sending. No message is sent by Primal Directive.</p>
                <button type="button" className="mt-3 min-h-10 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 font-semibold text-accent hover:bg-accent/20" onClick={() => {
                  const artist = useMusician.getState().profile.artistName || "our band";
                  const venue = g.venue || g.name;
                  const subject = "Booking inquiry — " + artist + " / " + venue;
                  const body = "Hello,\\n\\nI'm reaching out on behalf of " + artist + " to ask about potential booking opportunities at " + venue + (g.city ? " in " + g.city : "") + ". We'd love to learn about your submission process and any appropriate upcoming dates.\\n\\nHappy to share our EPK, live footage, and recent draw information if useful.\\n\\nThanks for your consideration,\\n" + artist;
                  const draft = "Subject: " + subject + "\\n\\n" + body;
                  void navigator.clipboard?.writeText(draft);
                  updateGig(g.id, {outreachNotes: [g.outreachNotes, "DRAFT (not sent) — " + new Date().toISOString().slice(0,10) + "\\n" + draft].filter(Boolean).join("\\n\\n")});
                }}>Prepare draft and copy</button>
                <p className="mt-2 text-muted">Draft saved to outreach notes. Clipboard access depends on browser permission.</p>
              </div>
              <p className="mt-2 text-muted">Manual record only; no messages are sent automatically.</p>
            </details>
            </div>
          ))
        )}
      </Card>}
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
