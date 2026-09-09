import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Eyebrow } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { money } from "@/lib/format";
import { deriveSignals } from "@/lib/signals";
import {
  pipelineGigs,
  pipelineValue,
  sumMoney,
  useMusician,
  weightedValue,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/board")({ component: BoardPage });

function BoardPage() {
  const gigs = useMusician((s) => s.gigs);
  const moneyEntries = useMusician((s) => s.money);
  const people = useMusician((s) => s.people);
  const collected = sumMoney(moneyEntries, "collected");
  const outstanding = sumMoney(moneyEntries, "outstanding");
  const costs = sumMoney(moneyEntries, "cost");
  const profit = collected - costs;
  const open = pipelineGigs(gigs);
  const signals = deriveSignals(gigs, moneyEntries, people);

  return (
    <div>
      <Eyebrow>Booking board</Eyebrow>
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Collected" value={money(collected)} hint="cash logged" />
        <MetricCard label="Outstanding" value={money(outstanding)} hint="money to collect" />
        <MetricCard label="Open pipeline" value={money(pipelineValue(gigs))} hint={`${open.length} opportunities`} />
        <MetricCard label="Weighted" value={money(Math.round(weightedValue(gigs)))} hint="fee × confidence" />
      </div>
      <MetricCard
        className="mt-2.5"
        label="Real gig profit"
        value={money(profit)}
        hint={profit < 0 ? "loss after tracked costs" : "after tracked costs"}
      />

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
