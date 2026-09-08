import { createFileRoute } from "@tanstack/react-router";
import { Card, Eyebrow } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { downloadCsv, longDate, money } from "@/lib/format";
import { sumMoney, useMusician } from "@/lib/store";
import { MONEY_TYPE_LABEL, type MoneyType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/money")({ component: MoneyPage });

const tone: Record<MoneyType, "live" | "warn" | "danger"> = {
  collected: "live",
  outstanding: "warn",
  cost: "danger",
};

function MoneyPage() {
  const entries = useMusician((s) => s.money);
  const openMoney = useMusician((s) => s.openMoney);
  const collected = sumMoney(entries, "collected");
  const outstanding = sumMoney(entries, "outstanding");
  const costs = sumMoney(entries, "cost");
  const profit = collected - costs;

  return (
    <div>
      <div className="mb-2 flex items-end justify-between px-1">
        <Eyebrow>Money</Eyebrow>
        <button
          type="button"
          className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg"
          onClick={() =>
            downloadCsv("money.csv", [
              ["type", "amount", "label", "date"],
              ...entries.map((m) => [
                m.type,
                String(m.amount),
                m.label,
                m.date,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Collected" value={money(collected)} hint="tracked income" />
        <MetricCard label="Costs" value={money(costs)} hint="tracked expenses" />
        <MetricCard
          label="Outstanding"
          value={money(outstanding)}
          hint="still owed"
        />
        <MetricCard
          label="Profit"
          value={money(profit)}
          hint="collected minus costs"
        />
      </div>

      <Eyebrow>Real gig economics</Eyebrow>
      <Card>
        <h2 className="font-display text-lg font-semibold">
          Track fee, travel, and merch — not vanity gross
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The board turns this ledger into actual profit. Log remainders the
          night of the show so outstanding does not go quiet.
        </p>
      </Card>

      <Eyebrow>Ledger</Eyebrow>
      <Card className="p-0">
        {entries.length === 0 ? (
          <EmptyState
            title="No money logged"
            body="Capture a guarantee, a merch night, or a van receipt."
            action="Add money"
            onAction={() => openMoney()}
          />
        ) : (
          entries.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => openMoney(m.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2",
                i < entries.length - 1 && "border-b border-line",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{m.label}</div>
                <div className="text-xs text-muted">{longDate(m.date)}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    "text-sm font-semibold tabular",
                    m.type === "cost" && "text-danger",
                    m.type === "collected" && "text-live",
                  )}
                >
                  {m.type === "cost" ? "−" : ""}
                  {money(m.amount)}
                </span>
                <Badge tone={tone[m.type]}>{MONEY_TYPE_LABEL[m.type]}</Badge>
              </div>
            </button>
          ))
        )}
      </Card>
    </div>
  );
}
