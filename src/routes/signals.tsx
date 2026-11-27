import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ExternalLink, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "@/components/metric-card";
import { Card } from "@/components/ui/card";
import {
  listAgentSignals,
  updateAgentSignalStatus,
  type AgentSignalRow,
  type AgentSignalStatus,
} from "@/lib/agent-signals";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signals")({ component: SignalsInboxPage });

const FILTERS: ReadonlyArray<"all" | AgentSignalStatus> = [
  "all",
  "new",
  "approved",
  "reviewed",
  "archived",
  "rejected",
];

const STATUS_STYLE: Record<AgentSignalStatus, string> = {
  new: "border-accent/40 bg-accent/10 text-accent",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  reviewed: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  imported: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  archived: "border-line bg-surface-2 text-muted",
  rejected: "border-warn/40 bg-warn/10 text-warn",
};

function SignalsInboxPage() {
  const [signals, setSignals] = useState<AgentSignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AgentSignalStatus>("all");

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
    const c = { new: 0, approved: 0, reviewed: 0 };
    for (const s of signals) {
      if (s.status === "new") c.new += 1;
      else if (s.status === "approved") c.approved += 1;
      else if (s.status === "reviewed" || s.status === "imported") c.reviewed += 1;
    }
    return c;
  }, [signals]);

  const visible = useMemo(
    () => (filter === "all" ? signals : signals.filter((s) => s.status === filter)),
    [signals, filter],
  );

  async function setStatus(id: string, status: AgentSignalStatus) {
    setBusyId(id);
    try {
      const { signal } = await updateAgentSignalStatus({ data: { id, status } });
      setSignals((prev) => prev.map((item) => (item.id === signal.id ? signal : item)));
      toast.success(`Signal marked ${status}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update signal.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MetricCard label="New signals" value={String(counts.new)} hint="awaiting triage" />
        <MetricCard label="Approved" value={String(counts.approved)} hint="ready for action" />
        <MetricCard label="Reviewed" value={String(counts.reviewed)} hint="triaged or imported" />
        <MetricCard label="Total intake" value={String(signals.length)} hint="latest 100 signals" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold">Signals Inbox</h2>
            <p className="mt-1 text-xs text-muted">
              Structured intake from external research bots via{" "}
              <code className="text-fg">POST /api/intake/agent-signal</code>. Nothing is emailed or
              mutated automatically without your approval.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-3 text-xs font-semibold text-fg hover:border-accent/50 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "min-h-9 rounded-md border px-3 text-xs font-semibold capitalize",
                filter === item
                  ? "border-accent bg-accent/15 text-fg"
                  : "border-line text-muted hover:text-fg",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      {loading && signals.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-muted">Loading signals…</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm font-semibold">
              {signals.length === 0 ? "No agent signals received yet" : "No signals in this filter"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted">
              {signals.length === 0
                ? "External research bots can POST Bearer-authenticated JSON payloads to /api/intake/agent-signal to queue venue leads and market intelligence here."
                : "Switch status filters or refresh to inspect other signals."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((signal) => {
            const busy = busyId === signal.id;
            const hasPayload = signal.payloadJson.length > 0;
            return (
              <Card key={signal.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                          STATUS_STYLE[signal.status],
                        )}
                      >
                        {signal.status}
                      </span>
                      <span className="rounded-full border border-line bg-bg px-2 py-0.5 text-[11px] font-medium text-muted">
                        {signal.sourceAgent}
                      </span>
                      <span className="rounded-full border border-line bg-bg px-2 py-0.5 text-[11px] font-medium text-muted">
                        {signal.signalType}
                      </span>
                      <span className="text-[11px] text-muted">
                        {new Date(signal.receivedAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="mt-2 font-display text-base font-semibold text-fg">
                      {signal.title}
                    </h3>
                    {signal.summary ? (
                      <p className="mt-1 text-sm leading-relaxed text-muted">{signal.summary}</p>
                    ) : null}
                    {signal.sourceUrl ? (
                      <a
                        href={signal.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                      >
                        {signal.sourceUrl}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </div>

                {hasPayload ? (
                  <details className="rounded-lg border border-line bg-bg/70 px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-muted">
                      Structured payload
                    </summary>
                    <pre className="mt-2 overflow-x-auto text-[11px] text-fg">
                      {signal.payloadJson}
                    </pre>
                  </details>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    disabled={busy || signal.status === "approved"}
                    onClick={() => void setStatus(signal.id, "approved")}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40"
                  >
                    <Check className="size-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy || signal.status === "reviewed"}
                    onClick={() => void setStatus(signal.id, "reviewed")}
                    className="min-h-9 rounded-md border border-line-strong px-3 text-xs font-semibold text-fg hover:bg-surface-2 disabled:opacity-40"
                  >
                    Mark reviewed
                  </button>
                  <button
                    type="button"
                    disabled={busy || signal.status === "archived"}
                    onClick={() => void setStatus(signal.id, "archived")}
                    className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-muted hover:text-fg disabled:opacity-40"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    disabled={busy || signal.status === "rejected"}
                    onClick={() => void setStatus(signal.id, "rejected")}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md border border-warn/40 px-3 text-xs font-semibold text-warn hover:bg-warn/10 disabled:opacity-40"
                  >
                    <X className="size-3.5" /> Reject
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
