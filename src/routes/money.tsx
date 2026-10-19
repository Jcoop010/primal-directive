import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
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
  const gigs = useMusician((s) => s.gigs);
  const openMoney = useMusician((s) => s.openMoney);
  const [ledgerType, setLedgerType] = useState<"all" | MoneyType>("all");
  const [ledgerQuery, setLedgerQuery] = useState("");
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const matchesType = ledgerType === "all" || entry.type === ledgerType;
    const query = ledgerQuery.trim().toLowerCase();
    const gig = gigs.find((item) => item.id === entry.gigId);
    return matchesType && (!query || [entry.label, entry.date, gig?.name, gig?.venue, gig?.city].some((value) => value?.toLowerCase().includes(query)));
  }).sort((a, b) => b.date.localeCompare(a.date)), [entries, gigs, ledgerType, ledgerQuery]);
  const collected = sumMoney(entries, "collected");
  const outstanding = sumMoney(entries, "outstanding");
  const costs = sumMoney(entries, "cost");
  const profit = collected - costs;
  const showEconomics = gigs.filter((gig) => gig.status === "booked" || gig.status === "completed").map((gig) => {
    const linked = entries.filter((entry) => entry.gigId === gig.id);
    const received = sumMoney(linked, "collected");
    const owed = sumMoney(linked, "outstanding");
    const expenses = sumMoney(linked, "cost");
    return { gig, received, owed, expenses, net: received - expenses, projected: received + owed - expenses, hasLedger: linked.length > 0 };
  }).sort((a, b) => a.gig.date.localeCompare(b.gig.date));

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
              ...filteredEntries.map((m) => [
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <Eyebrow>Show economics</Eyebrow>
      <Card className="command-surface">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Show-by-show profitability</h2><p className="mt-2 max-w-2xl text-xs text-muted">Compare recorded income, outstanding payments, and costs across booked and completed shows. All figures are linked ledger entries, not forecasts of ticket sales or unverified venue offers.</p></div><span className="rounded-full border border-info/30 bg-info/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-info">Ledger-based · no estimates</span></div>
        {showEconomics.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted"><th className="pb-3 pr-3">Show</th><th className="pb-3 pr-3 text-right">Collected</th><th className="pb-3 pr-3 text-right">Outstanding</th><th className="pb-3 pr-3 text-right">Costs</th><th className="pb-3 pr-3 text-right">Net collected</th><th className="pb-3 text-right">If owed is paid</th></tr></thead><tbody>{showEconomics.map(({gig,received,owed,expenses,net,projected,hasLedger}) => <tr key={gig.id} className="border-b border-line/70 last:border-0"><td className="py-3 pr-3"><div className="font-semibold">{gig.venue || gig.name}</div><div className="mt-1 text-[10px] text-muted">{gig.city || "City not entered"} · {gig.date ? longDate(gig.date) : "Date not entered"} · {gig.status}</div></td><td className="py-3 pr-3 text-right tabular">{hasLedger ? money(received) : "—"}</td><td className="py-3 pr-3 text-right tabular">{hasLedger ? money(owed) : "—"}</td><td className="py-3 pr-3 text-right tabular">{hasLedger ? money(expenses) : "—"}</td><td className={cn("py-3 pr-3 text-right font-bold tabular", hasLedger && net < 0 ? "text-warn" : "text-live")}>{hasLedger ? money(net) : "Not tracked"}</td><td className="py-3 text-right font-bold tabular">{hasLedger ? money(projected) : "Not tracked"}</td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-xl border border-dashed border-line p-5 text-sm text-muted">No booked or completed shows yet. Add confirmed bookings to start comparing actual show economics.</p>}
        <p className="mt-4 text-[11px] leading-relaxed text-muted">A dash means no ledger records were linked to that show, not zero revenue or expenses. “If owed is paid” assumes all recorded outstanding amounts are collected; it does not include unrecorded guarantees, travel, lodging, or merch costs. Record those expenses to get meaningful comparisons.</p>
      </Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><Eyebrow>Ledger</Eyebrow><h3 className="mt-1 font-display text-lg font-bold">Financial activity</h3></div><button type="button" onClick={() => openMoney()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"><Plus className="size-4" /> Add entry</button></div>
      <div className="mb-3 rounded-xl border border-line bg-surface p-3">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted" /><span className="sr-only">Search ledger</span><input type="search" value={ledgerQuery} onChange={(event) => setLedgerQuery(event.target.value)} placeholder="Search transactions or shows..." className="min-h-10 w-full rounded-lg border border-line bg-bg py-2 pl-10 pr-3 text-sm text-fg" /></label>
        <div className="mt-3 flex flex-wrap gap-2">{(["all", "collected", "outstanding", "cost"] as const).map((value) => <button key={value} type="button" aria-pressed={ledgerType === value} onClick={() => setLedgerType(value)} className={cn("min-h-9 rounded-lg border px-3 text-xs font-semibold",ledgerType === value ? "border-accent bg-accent/10 text-fg" : "border-line text-muted")}>{value === "all" ? "All entries" : MONEY_TYPE_LABEL[value]}</button>)}</div>
        <p className="mt-2 text-xs text-muted">Showing {filteredEntries.length} of {entries.length} entries. Export CSV uses the current filtered view.</p>
      </div>
      <Card className="command-surface overflow-hidden p-0">
        {filteredEntries.length === 0 ? (
          <EmptyState
            title={entries.length === 0 ? "No money logged" : "No matching entries"}
            body={entries.length === 0 ? "Capture a guarantee, a merch night, or a van receipt." : "Try another search or transaction filter."}
            action="Add money"
            onAction={() => openMoney()}
          />
        ) : (
          filteredEntries.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => openMoney(m.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2",
                i < filteredEntries.length - 1 && "border-b border-line",
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
