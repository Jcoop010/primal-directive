import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  ArrowUpDown,
  Check,
  ExternalLink,
  Flame,
  Music2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "@/components/metric-card";
import { Card } from "@/components/ui/card";
import {
  filterAndSortSignals,
  type SignalPriorityTier,
  type SignalSortMode,
} from "@/lib/agent-signal-scoring";
import {
  convertAgentSignalToLead,
  listAgentSignals,
  updateAgentSignalStatus,
  type AgentSignalRow,
  type AgentSignalStatus,
} from "@/lib/agent-signals";
import { useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signals")({ component: SignalsInboxPage });

const STATUS_FILTERS: ReadonlyArray<"all" | AgentSignalStatus> = [
  "all",
  "new",
  "approved",
  "reviewed",
  "archived",
  "rejected",
];

const PRIORITY_FILTERS: ReadonlyArray<{ key: "all" | SignalPriorityTier; label: string }> = [
  { key: "all", label: "All priorities" },
  { key: "high", label: "High priority" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

const STATUS_STYLE: Record<AgentSignalStatus, string> = {
  new: "border-[#E25822]/50 bg-[#E25822]/15 text-[#ff9b6a]",
  approved: "border-live/45 bg-live/12 text-live",
  reviewed: "border-info/45 bg-info/12 text-info",
  imported: "border-info/45 bg-info/12 text-info",
  archived: "border-line bg-surface-2 text-muted",
  rejected: "border-danger/45 bg-danger/12 text-danger",
};

const PRIORITY_STYLE: Record<SignalPriorityTier, string> = {
  high: "border-[#E25822]/60 bg-[#E25822]/20 text-[#ffb088]",
  medium: "border-warn/45 bg-warn/12 text-warn",
  low: "border-line bg-bg text-muted",
};

function SignalsInboxPage() {
  const [signals, setSignals] = useState<AgentSignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AgentSignalStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | SignalPriorityTier>("all");
  const [sortMode, setSortMode] = useState<SignalSortMode>("score");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAgentSignals();
      setSignals(res.signals);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const c = { new: 0, high: 0, approved: 0, archived: 0 };
    for (const s of signals) {
      if (s.status === "new") c.new += 1;
      if (s.priorityTier === "high" && s.status !== "archived" && s.status !== "rejected") {
        c.high += 1;
      }
      if (s.status === "approved") c.approved += 1;
      if (s.status === "archived") c.archived += 1;
    }
    return c;
  }, [signals]);

  const visible = useMemo(
    () =>
      filterAndSortSignals(signals, {
        statusFilter,
        priorityFilter,
        sortMode,
      }),
    [signals, statusFilter, priorityFilter, sortMode],
  );

  async function setStatus(id: string, nextStatus: AgentSignalStatus) {
    const previous = signals;
    setBusyId(id);
    // Optimistic transition for snappy single-click triage; rolls back on error.
    setSignals((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)),
    );
    try {
      const { signal } = await updateAgentSignalStatus({ data: { id, status: nextStatus } });
      setSignals((prev) => prev.map((item) => (item.id === signal.id ? signal : item)));
      toast.success(`Signal marked ${nextStatus}.`);
    } catch (error) {
      setSignals(previous);
      toast.error(error instanceof Error ? error.message : "Could not update signal.");
    } finally {
      setBusyId(null);
    }
  }

  async function convertToLead(id: string) {
    setBusyId(id);
    try {
      const res = await convertAgentSignalToLead({ data: { id } });
      setSignals((prev) => prev.map((item) => (item.id === res.signal.id ? res.signal : item)));
      if (res.gig) {
        const existing = useMusician.getState().gigs;
        if (!existing.some((g) => g.id === res.gig!.id)) {
          useMusician.setState({ gigs: [res.gig, ...existing] });
        }
      }
      toast.success(
        res.alreadyConverted
          ? "Signal was already converted to a gig lead."
          : "Converted signal into a booking lead.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not convert signal.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MetricCard label="New intake" value={String(counts.new)} hint="awaiting triage" />
        <MetricCard label="High priority" value={String(counts.high)} hint="score 75+ or urgent" />
        <MetricCard label="Approved" value={String(counts.approved)} hint="cleared for action" />
        <MetricCard
          label="Archived"
          value={String(counts.archived)}
          hint={`of ${signals.length} total`}
        />
      </div>

      <section
        aria-label="Signals triage controls"
        className="rounded-2xl border border-[#243652] bg-[#0A1628]/90 p-4 shadow-card sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#E25822]">
              <Sparkles className="size-3.5" /> Signal Command Center
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-fg">
              High-leverage intake triage
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Structured leads and intel posted to{" "}
              <code className="rounded bg-bg/80 px-1.5 py-0.5 text-soft">
                POST /api/intake/agent-signal
              </code>{" "}
              are scored deterministically (0–100) and gated behind your explicit approval.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortMode((m) => (m === "score" ? "newest" : "score"))}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-bg/70 px-3 text-xs font-semibold text-fg hover:border-[#E25822]/60"
            >
              <ArrowUpDown className="size-3.5 text-[#E25822]" />
              Sort: {sortMode === "score" ? "Highest score" : "Newest"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void refresh()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 text-xs font-semibold text-fg hover:border-accent/60 disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={statusFilter === item}
              onClick={() => setStatusFilter(item)}
              className={cn(
                "min-h-9 rounded-lg border px-3 text-xs font-semibold capitalize",
                statusFilter === item
                  ? "border-[#E25822] bg-[#E25822]/15 text-fg"
                  : "border-line bg-bg/50 text-muted hover:text-fg",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {PRIORITY_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={priorityFilter === item.key}
              onClick={() => setPriorityFilter(item.key)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold",
                priorityFilter === item.key
                  ? item.key === "high"
                    ? "border-[#E25822] bg-[#E25822]/20 text-[#ffb088]"
                    : "border-accent/60 bg-accent/15 text-fg"
                  : "border-line bg-bg/40 text-muted hover:text-fg",
              )}
            >
              {item.key === "high" ? <Flame className="size-3 text-[#E25822]" /> : null}
              {item.label}
            </button>
          ))}
          {(statusFilter !== "all" || priorityFilter !== "all" || sortMode !== "score") && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setSortMode("score");
              }}
              className="ml-auto text-xs font-semibold text-[#E25822] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </section>

      {loading && signals.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted">Loading signals…</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <div className="py-9 text-center">
            <p className="text-sm font-semibold text-fg">
              {signals.length === 0
                ? "No agent signals received yet"
                : "No signals match these filters"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted">
              {signals.length === 0
                ? "External research bots can POST Bearer-authenticated JSON payloads to /api/intake/agent-signal to surface scored venue leads and market intel here."
                : "Try switching status or priority filters to inspect other signals."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((signal) => {
            const busy = busyId === signal.id;
            const hasPayload = signal.payloadJson.length > 0;
            const isHigh = signal.priorityTier === "high";
            return (
              <article
                key={signal.id}
                className={cn(
                  "rounded-2xl border p-4 shadow-card transition-colors sm:p-5",
                  isHigh
                    ? "border-[#E25822]/45 bg-[#0A1628]/95"
                    : "border-line bg-surface",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "tabular inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                          PRIORITY_STYLE[signal.priorityTier],
                        )}
                      >
                        {isHigh ? <Flame className="size-3 text-[#E25822]" /> : null}
                        {signal.fitScore} · {signal.priorityTier}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                          STATUS_STYLE[signal.status],
                        )}
                      >
                        {signal.status}
                      </span>
                      {signal.urgency === "urgent" || signal.urgency === "high" ? (
                        <span className="rounded-full border border-[#D35400]/60 bg-[#D35400]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#ff9b6a]">
                          {signal.urgency}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-line bg-bg/70 px-2 py-0.5 text-[11px] font-medium text-soft">
                        {signal.sourceAgent}
                      </span>
                      <span className="rounded-full border border-line bg-bg/70 px-2 py-0.5 text-[11px] font-medium text-muted">
                        {signal.signalType}
                      </span>
                      <span className="text-[11px] text-muted">
                        {new Date(signal.receivedAt).toLocaleString()}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-bold text-fg">{signal.title}</h3>

                    {signal.summary ? (
                      <p className="text-sm leading-relaxed text-soft/90">{signal.summary}</p>
                    ) : null}

                    {signal.recommendedAction ? (
                      <div className="rounded-lg border border-[#E25822]/30 bg-[#E25822]/10 px-3 py-2 text-xs text-[#ffd2bc]">
                        <span className="font-bold uppercase tracking-wider text-[#E25822]">
                          Next action:{" "}
                        </span>
                        {signal.recommendedAction}
                      </div>
                    ) : null}

                    {signal.sourceUrl ? (
                      <a
                        href={signal.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-semibold text-accent hover:underline"
                      >
                        <span className="truncate">{signal.sourceUrl}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ) : null}
                  </div>
                </div>

                {hasPayload ? (
                  <details className="mt-3 rounded-lg border border-line bg-bg/75 px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-muted hover:text-fg">
                      Structured payload
                    </summary>
                    <pre className="mt-2 overflow-x-auto text-[11px] text-soft">
                      {signal.payloadJson}
                    </pre>
                  </details>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
                  {signal.convertedGigId ? (
                    <Link
                      to="/gigs"
                      search={{ gig: signal.convertedGigId }}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-live/50 bg-live/15 px-3.5 text-xs font-bold text-live hover:bg-live/25"
                    >
                      View lead <ArrowRight className="size-3.5" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void convertToLead(signal.id)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E25822]/60 bg-[#0A1628] px-3.5 text-xs font-bold text-[#ffb088] hover:border-[#E25822] hover:bg-[#E25822]/15 disabled:opacity-40"
                    >
                      <Music2 className="size-3.5 text-[#E25822]" />
                      {busy ? "Converting…" : "Convert to Lead"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy || signal.status === "approved"}
                    onClick={() => void setStatus(signal.id, "approved")}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#E25822] px-3.5 text-xs font-bold text-white hover:bg-[#D35400] disabled:opacity-40"
                  >
                    <Check className="size-3.5" />
                    {busy ? "Saving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || signal.status === "archived"}
                    onClick={() => void setStatus(signal.id, "archived")}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3.5 text-xs font-semibold text-fg hover:border-muted disabled:opacity-40"
                  >
                    <Archive className="size-3.5" /> Archive
                  </button>
                  <button
                    type="button"
                    disabled={busy || signal.status === "reviewed"}
                    onClick={() => void setStatus(signal.id, "reviewed")}
                    className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold text-muted hover:text-fg disabled:opacity-40"
                  >
                    Mark reviewed
                  </button>
                  <button
                    type="button"
                    disabled={busy || signal.status === "rejected"}
                    onClick={() => void setStatus(signal.id, "rejected")}
                    className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-lg border border-danger/40 px-3 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-40"
                  >
                    <X className="size-3.5" /> Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
