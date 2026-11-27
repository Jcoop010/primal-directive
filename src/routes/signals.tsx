import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ExternalLink,
  Flame,
  MapPin,
  Music2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "@/components/metric-card";
import { Card } from "@/components/ui/card";
import {
  applyCorridorPreset,
  clearAnchorsFromFilterState,
  computeRoutingGapFit,
  createDefaultSignalsFilterState,
  filterAndSortSignals,
  TOURING_CORRIDOR_PRESETS,
  type RoutingAnchorWindow,
  type SignalPriorityTier,
  type SignalsFilterState,
  type TouringCorridorPreset,
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
  "imported",
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
  imported: "border-live/45 bg-live/12 text-live",
  archived: "border-line bg-surface-2 text-muted",
  rejected: "border-danger/45 bg-danger/12 text-danger",
};

const PRIORITY_STYLE: Record<SignalPriorityTier, string> = {
  high: "border-[#E25822]/60 bg-[#E25822]/20 text-[#ffb088]",
  medium: "border-warn/45 bg-warn/12 text-warn",
  low: "border-line bg-bg text-muted",
};

type BusyAction = { id: string; kind: "approve" | "archive" | "review" | "reject" | "convert" };

function SignalsInboxPage() {
  const [signals, setSignals] = useState<AgentSignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [filterState, setFilterState] = useState<SignalsFilterState<AgentSignalStatus>>(() =>
    createDefaultSignalsFilterState<AgentSignalStatus>(),
  );
  const { statusFilter, priorityFilter, sortMode, prevCity, prevDate, nextCity, nextDate, activePresetId } =
    filterState;

  const anchors: RoutingAnchorWindow = useMemo(
    () => ({ prevCity, prevDate, nextCity, nextDate }),
    [prevCity, prevDate, nextCity, nextDate],
  );
  const hasAnchors = Boolean(
    prevCity.trim() || prevDate.trim() || nextCity.trim() || nextDate.trim(),
  );
  const hasActiveFilters =
    statusFilter !== "all" || priorityFilter !== "all" || sortMode !== "score" || hasAnchors;

  const resetAllFilters = () => {
    setFilterState(createDefaultSignalsFilterState<AgentSignalStatus>());
  };

  const selectCorridorPreset = (preset: TouringCorridorPreset) => {
    setFilterState(applyCorridorPreset<AgentSignalStatus>(preset));
  };

  const updateAnchorField = (
    field: "prevCity" | "prevDate" | "nextCity" | "nextDate",
    value: string,
  ) => {
    setFilterState((prev) => ({ ...prev, [field]: value, activePresetId: null }));
  };

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
      if (s.status === "approved" || s.status === "imported") c.approved += 1;
      if (s.status === "archived") c.archived += 1;
    }
    return c;
  }, [signals]);

  const enrichedSignals = useMemo(
    () =>
      signals.map((signal) => {
        const gap = computeRoutingGapFit(signal, anchors);
        return {
          ...signal,
          computedGapScore: gap.gapFitScore,
          computedGapLabel: gap.gapLabel,
          computedGapReason: gap.gapReason,
          gapFitScore: gap.gapFitScore ?? signal.gapFitScore,
        };
      }),
    [signals, anchors],
  );

  const visible = useMemo(
    () =>
      filterAndSortSignals(enrichedSignals, {
        statusFilter,
        priorityFilter,
        sortMode,
      }),
    [enrichedSignals, statusFilter, priorityFilter, sortMode],
  );

  async function setStatus(
    id: string,
    nextStatus: AgentSignalStatus,
    kind: BusyAction["kind"],
  ) {
    const previous = signals;
    setBusyAction({ id, kind });
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
      setBusyAction(null);
    }
  }

  async function convertToLead(
    id: string,
    gapMeta?: { gapFitScore?: number | null; gapReason?: string | null },
  ) {
    setBusyAction({ id, kind: "convert" });
    try {
      const anchorParts = [
        prevCity.trim() || prevDate.trim()
          ? `From ${prevCity.trim() || "prev stop"} ${prevDate.trim()}`.trim()
          : "",
        nextCity.trim() || nextDate.trim()
          ? `To ${nextCity.trim() || "next stop"} ${nextDate.trim()}`.trim()
          : "",
        gapMeta?.gapReason ?? "",
      ].filter(Boolean);
      const res = await convertAgentSignalToLead({
        data: {
          id,
          ...(typeof gapMeta?.gapFitScore === "number" ? { gapFitScore: gapMeta.gapFitScore } : {}),
          ...(anchorParts.length > 0 ? { anchorGapNote: anchorParts.join(" · ").slice(0, 400) } : {}),
        },
      });
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
      setBusyAction(null);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MetricCard label="New intake" value={String(counts.new)} hint="awaiting triage" />
        <MetricCard label="High priority" value={String(counts.high)} hint="score 75+ or urgent" />
        <MetricCard label="Approved / leads" value={String(counts.approved)} hint="cleared for action" />
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#E25822]">
              <Sparkles className="size-3.5" /> Signal Command Center
            </div>
            <h2 className="mt-0.5 font-display text-lg font-bold text-fg">
              Band booking &amp; routing triage
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setFilterState((prev) => ({
                  ...prev,
                  sortMode:
                    prev.sortMode === "score"
                      ? hasAnchors
                        ? "gap"
                        : "newest"
                      : prev.sortMode === "gap"
                        ? "newest"
                        : "score",
                }))
              }
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-bg/70 px-3 text-xs font-semibold text-fg hover:border-[#E25822]/60"
            >
              <ArrowUpDown className="size-3.5 text-[#E25822]" />
              <span>
                Sort:{" "}
                {sortMode === "score"
                  ? "Highest score"
                  : sortMode === "gap"
                    ? "Gap fit"
                    : "Newest"}
              </span>
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

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-3">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={statusFilter === item}
              onClick={() => setFilterState((prev) => ({ ...prev, statusFilter: item }))}
              className={cn(
                "min-h-9 rounded-lg border px-2.5 text-xs font-semibold capitalize",
                statusFilter === item
                  ? "border-[#E25822] bg-[#E25822]/15 text-fg"
                  : "border-line bg-bg/50 text-muted hover:text-fg",
              )}
            >
              {item === "imported" ? "Converted" : item}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {PRIORITY_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={priorityFilter === item.key}
              onClick={() => setFilterState((prev) => ({ ...prev, priorityFilter: item.key }))}
              className={cn(
                "inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold",
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
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetAllFilters}
              className="ml-auto inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-[#E25822] hover:underline"
            >
              <RotateCcw className="size-3" /> Reset
            </button>
          ) : null}
        </div>

        <div className="mt-3 border-t border-line/70 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3 text-[#E25822]" /> Anchor-date routing gap
            </span>
            {hasAnchors ? (
              <button
                type="button"
                onClick={() => setFilterState((prev) => clearAnchorsFromFilterState(prev))}
                className="text-[11px] font-semibold normal-case text-[#E25822] hover:underline"
              >
                Clear anchors
              </button>
            ) : null}
          </div>

          <div
            role="group"
            aria-label="Touring corridor presets"
            className="mb-2.5 flex flex-wrap items-center gap-1.5"
          >
            <span className="mr-0.5 text-[11px] font-medium text-muted">Presets:</span>
            {TOURING_CORRIDOR_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectCorridorPreset(preset)}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                    isSelected
                      ? "border-[#E25822] bg-[#E25822]/20 text-[#ffb088]"
                      : "border-line bg-bg/50 text-soft hover:border-[#E25822]/60 hover:text-fg",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="text"
              aria-label="Previous stop city"
              value={prevCity}
              onChange={(e) => updateAnchorField("prevCity", e.target.value)}
              placeholder="Prev stop (e.g. Nashville, TN)"
              className="min-h-10 w-full min-w-0 rounded-lg border border-line bg-bg/70 px-3 text-xs text-fg outline-none focus:border-[#E25822]"
            />
            <input
              type="date"
              aria-label="Previous stop date"
              value={prevDate}
              onChange={(e) => updateAnchorField("prevDate", e.target.value)}
              className="min-h-10 w-full min-w-0 rounded-lg border border-line bg-bg/70 px-3 text-xs text-fg outline-none focus:border-[#E25822]"
            />
            <input
              type="text"
              aria-label="Next stop city"
              value={nextCity}
              onChange={(e) => updateAnchorField("nextCity", e.target.value)}
              placeholder="Next stop (e.g. Asheville, NC)"
              className="min-h-10 w-full min-w-0 rounded-lg border border-line bg-bg/70 px-3 text-xs text-fg outline-none focus:border-[#E25822]"
            />
            <input
              type="date"
              aria-label="Next stop date"
              value={nextDate}
              onChange={(e) => updateAnchorField("nextDate", e.target.value)}
              className="min-h-10 w-full min-w-0 rounded-lg border border-line bg-bg/70 px-3 text-xs text-fg outline-none focus:border-[#E25822]"
            />
          </div>
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
                ? "No band signals received yet"
                : "No signals match your active filters or anchors"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted">
              {signals.length === 0
                ? "External scout bots can POST Bearer-authenticated JSON payloads to /api/intake/agent-signal to surface scored venue, support, and festival leads here."
                : "Reset filters or clear your anchor stops to view the full band signal queue."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#E25822] px-4 text-xs font-bold text-white hover:bg-[#D35400]"
              >
                <RotateCcw className="size-3.5" /> Reset filters &amp; anchors
              </button>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((signal) => {
            const isBusy = busyAction?.id === signal.id;
            const busyKind = isBusy ? busyAction?.kind : null;
            const isArchivedOrRejected =
              signal.status === "archived" || signal.status === "rejected";
            const isConverted = Boolean(signal.convertedGigId);
            const isHigh = signal.priorityTier === "high" && !isArchivedOrRejected;
            const hasPayload = signal.payloadJson.length > 0;

            return (
              <article
                key={signal.id}
                className={cn(
                  "min-w-0 rounded-2xl border p-4 shadow-card transition-colors sm:p-5",
                  isConverted
                    ? "border-live/35 border-l-4 border-l-live bg-surface"
                    : isArchivedOrRejected
                      ? "border-line/70 bg-surface/60 opacity-75"
                      : isHigh
                        ? "border-[#E25822]/45 bg-[#0A1628]/95"
                        : "border-line bg-surface",
                )}
              >
                {/* Top Row: Title / Source / Corridor + Score & Gap Badges */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-bold leading-snug text-fg">
                      {signal.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="font-semibold text-soft">{signal.sourceAgent}</span>
                      <span aria-hidden="true">·</span>
                      <span>{signal.signalType.replace("_", " ")}</span>
                      {signal.corridor ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-info">{signal.corridor}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "tabular inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                        PRIORITY_STYLE[signal.priorityTier],
                      )}
                    >
                      {isHigh ? <Flame className="size-3 text-[#E25822]" /> : null}
                      {signal.fitScore} · {signal.priorityTier}
                    </span>
                    {typeof signal.computedGapScore === "number" && signal.computedGapLabel ? (
                      <span
                        className={cn(
                          "tabular rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                          signal.computedGapScore >= 70
                            ? "border-live/50 bg-live/15 text-live"
                            : signal.computedGapScore >= 45
                              ? "border-warn/50 bg-warn/15 text-warn"
                              : "border-line bg-bg/70 text-muted",
                        )}
                      >
                        Gap {signal.computedGapScore} · {signal.computedGapLabel}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Middle Row: Routing / Bill Metadata Chips + Single-Line Fit / Action Summary */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      STATUS_STYLE[signal.status],
                    )}
                  >
                    {signal.status === "imported" ? "converted" : signal.status}
                  </span>
                  {signal.urgency === "urgent" || signal.urgency === "high" ? (
                    <span className="rounded-full border border-[#D35400]/60 bg-[#D35400]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#ff9b6a]">
                      {signal.urgency}
                    </span>
                  ) : null}
                  {signal.billRole ? (
                    <span className="rounded-full border border-[#243652] bg-[#0A1628] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-soft">
                      {signal.billRole.replace("_", " ")}
                    </span>
                  ) : null}
                  {signal.targetWindow ? (
                    <span className="rounded-full border border-line bg-bg/70 px-2 py-0.5 text-[11px] font-medium text-soft">
                      {signal.targetWindow}
                    </span>
                  ) : null}
                  {signal.dealType ? (
                    <span className="rounded-full border border-line bg-bg/70 px-2 py-0.5 text-[11px] font-medium text-muted">
                      {signal.dealType.replace("_", " ")}
                    </span>
                  ) : null}
                </div>

                {signal.computedGapReason || signal.recommendedAction ? (
                  <p className="mt-2 truncate text-xs text-soft">
                    {signal.computedGapReason ? (
                      <span className="font-semibold text-info">{signal.computedGapReason}</span>
                    ) : null}
                    {signal.computedGapReason && signal.recommendedAction ? (
                      <span className="text-muted"> — </span>
                    ) : null}
                    {signal.recommendedAction ? (
                      <span className="text-[#ffd2bc]">{signal.recommendedAction}</span>
                    ) : null}
                  </p>
                ) : null}

                {/* Collapsible Secondary Metadata: Summary, Verified Source & Raw Payload */}
                <details className="mt-2.5 rounded-lg border border-line/80 bg-bg/65 px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-muted hover:text-fg">
                    Details, source &amp; payload
                  </summary>
                  <div className="mt-2.5 space-y-2 border-t border-line/60 pt-2.5">
                    {signal.summary ? (
                      <p className="text-xs leading-relaxed text-soft/90">{signal.summary}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                      <span>Received {new Date(signal.receivedAt).toLocaleString()}</span>
                      {signal.sourceUrl ? (
                        <a
                          href={signal.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 truncate font-semibold text-accent hover:underline"
                        >
                          <span className="truncate">{signal.sourceUrl}</span>
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      ) : null}
                    </div>
                    {hasPayload ? (
                      <pre className="overflow-x-auto rounded border border-line/70 bg-bg p-2 text-[11px] text-soft">
                        {signal.payloadJson}
                      </pre>
                    ) : null}
                  </div>
                </details>

                {/* Thumb-Friendly Action Row */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
                  {isConverted ? (
                    <Link
                      to="/gigs"
                      search={{ gig: signal.convertedGigId! }}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-live/50 bg-live/15 px-3.5 text-xs font-bold text-live hover:bg-live/25"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Converted · View lead <ArrowRight className="size-3.5" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void convertToLead(signal.id, {
                          gapFitScore: signal.computedGapScore,
                          gapReason: signal.computedGapReason,
                        })
                      }
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E25822]/60 bg-[#0A1628] px-3.5 text-xs font-bold text-[#ffb088] hover:border-[#E25822] hover:bg-[#E25822]/15 disabled:opacity-40"
                    >
                      <Music2 className="size-3.5 text-[#E25822]" />
                      {busyKind === "convert" ? "Converting…" : "Convert to Lead"}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy || signal.status === "approved" || isConverted}
                    onClick={() => void setStatus(signal.id, "approved", "approve")}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#E25822] px-3.5 text-xs font-bold text-white hover:bg-[#D35400] disabled:opacity-40"
                  >
                    <Check className="size-3.5" />
                    {busyKind === "approve" ? "Approving…" : "Approve"}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy || signal.status === "archived"}
                    onClick={() => void setStatus(signal.id, "archived", "archive")}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3.5 text-xs font-semibold text-fg hover:border-muted disabled:opacity-40"
                  >
                    <Archive className="size-3.5" />
                    {busyKind === "archive" ? "Archiving…" : "Archive"}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy || signal.status === "rejected"}
                    onClick={() => void setStatus(signal.id, "rejected", "reject")}
                    className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-lg border border-danger/35 px-3 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-40"
                  >
                    <X className="size-3.5" />
                    {busyKind === "reject" ? "Rejecting…" : "Reject"}
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
