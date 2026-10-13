import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardCheck, Download, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, Eyebrow } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { money, longDate, toIsoDay, downloadCsv } from "@/lib/format";
import { calculateSettlement } from "@/lib/settlement";
import { useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settlement")({ component: SettlementPage });
function SettlementPage() {
  const gigs = useMusician((state) => state.gigs);
  const people = useMusician((state) => state.people);
  const entries = useMusician((state) => state.money);
  const addMoney = useMusician((state) => state.addMoney);
  const [selectedGigId, setSelectedGigId] = useState("");
  const completedGigs = useMemo(() => gigs.filter((gig) => gig.status === "completed").sort((a, b) => b.date.localeCompare(a.date)), [gigs]);
  const selectedGig = completedGigs.find((gig) => gig.id === selectedGigId) ?? completedGigs[0];
  const bandMembers = people.filter((person) => person.role === "band");
  const summary = selectedGig ? calculateSettlement(selectedGig.id, bandMembers, entries) : null;
  const paid = Boolean(summary?.sharesValid && summary.netPool > 0 && summary.lines.every((line) => line.remaining === 0 && line.overpaid === 0));

  function recordPayout(memberId: string, memberName: string, amount: number) {
    if (!selectedGig || !summary?.sharesValid || amount <= 0) return;
    addMoney({ type: "payout", amount, label: `Gig payout — ${memberName}`, date: toIsoDay(new Date()), gigId: selectedGig.id, memberId });
    toast.success(`Recorded ${money(amount)} payout for ${memberName}`);
  }
  function exportSettlement() {
    if (!selectedGig || !summary) return;
    downloadCsv(`gig-closeout-${selectedGig.date || selectedGig.id}.csv`, [
      ["show", "date", "member", "share_percent", "net_pool", "amount_due", "amount_paid", "remaining"],
      ...summary.lines.map((line) => [selectedGig.name, selectedGig.date, line.memberName, line.sharePercent === undefined ? "" : String(line.sharePercent), String(summary.netPool), String(line.amountDue), String(line.amountPaid), String(line.remaining)]),
    ]);
  }

  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><Eyebrow>Show closeout</Eyebrow><h2 className="mt-2 text-xl font-extrabold tracking-tight">Gig closeout & payouts</h2><p className="mt-1 text-sm leading-relaxed text-muted">Reconcile recorded show cash, calculate band shares, and track each payout separately from operating costs.</p></div>
      <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2"><ClipboardCheck className="size-5 text-accent" /></div>
    </div>
    {completedGigs.length === 0 ? <Card className="p-4"><EmptyState title="No completed shows to close out" body="Mark a show Completed in Gigs after the performance, then return here to close out recorded income, costs, and payouts." action="Open gig pipeline" onAction={() => { window.location.href = "/gigs"; }} /></Card> : <>
      <Card className="space-y-3 p-4">
        <label className="block text-xs font-semibold text-muted" htmlFor="settlement-gig">Completed show</label>
        <select id="settlement-gig" value={selectedGig?.id ?? ""} onChange={(event) => setSelectedGigId(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm">
          {completedGigs.map((gig) => <option key={gig.id} value={gig.id}>{gig.name || gig.venue || "Untitled show"} · {longDate(gig.date)}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Collected cash" value={money(summary?.collected ?? 0)} />
          <Metric label="Operating costs" value={money(summary?.operatingCosts ?? 0)} />
          <Metric label="Available pool" value={money(summary?.netPool ?? 0)} />
          <Metric label="Still to pay" value={money(summary?.totalRemaining ?? 0)} />
        </div>
        <p className="text-xs leading-relaxed text-muted">Only entries linked to this show count. Outstanding income is excluded until collected. Taxes, reserves, commissions, and unrecorded expenses are not automatically deducted; enter applicable costs before paying members.</p>
      </Card>
      {!summary?.sharesValid ? <Card className="p-4"><div className="flex items-start gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" /><div><h3 className="text-sm font-bold">Band shares need setup</h3><p className="mt-1 text-sm leading-relaxed text-muted">Add a payout share to every Band contact and make sure all percentages total exactly 100%. Payout recording stays disabled until the split is valid.</p>{summary?.missingShareNames.length ? <p className="mt-2 text-xs text-muted">Missing shares: {summary.missingShareNames.join(", ")}</p> : summary ? <p className="mt-2 text-xs text-muted">Current total: {summary.shareTotal.toFixed(2)}% (must equal 100%).</p> : null}<a href="/people" className="mt-3 inline-flex text-sm font-semibold text-accent">Configure member shares →</a></div></div></Card> : null}
      <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">Member allocations</h3><button type="button" onClick={exportSettlement} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-fg"><Download className="size-3.5" /> Export CSV</button></div>
      {summary?.lines.map((line) => <Card key={line.memberId} className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold">{line.memberName}</div><div className="mt-1 text-xs text-muted">{line.sharePercent === undefined ? "Share not set" : `${line.sharePercent}% share`}</div></div><div className="text-right"><div className="text-lg font-extrabold tabular">{money(line.amountDue)}</div><div className="text-[10px] uppercase tracking-wider text-muted">Allocation</div></div></div>
        <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-surface-2 p-3"><div className="text-muted">Paid</div><div className="mt-1 font-bold">{money(line.amountPaid)}</div></div><div className="rounded-lg bg-surface-2 p-3"><div className="text-muted">Remaining</div><div className="mt-1 font-bold">{money(line.remaining)}</div></div></div>
        {line.overpaid > 0 ? <div className="text-xs text-danger">Recorded payouts exceed this allocation by {money(line.overpaid)}. Review the ledger before recording another payout.</div> : <button type="button" disabled={!summary?.sharesValid || line.remaining <= 0} onClick={() => recordPayout(line.memberId, line.memberName, line.remaining)} className={cn("flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold", line.remaining > 0 && summary?.sharesValid ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>{line.remaining > 0 ? `Record payout · ${money(line.remaining)}` : line.amountDue === 0 ? "No payout due" : <><CheckCircle2 className="size-4" /> Fully paid</>}</button>}
      </Card>)}
      {paid ? <Card className="p-4"><div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-live" /> All member allocations recorded as paid.</div><p className="mt-1 text-xs text-muted">This confirms entries in Primal Directive's ledger, not bank transfer completion.</p></Card> : null}
    </>}
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-surface-2 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div><div className="mt-1 text-lg font-extrabold tabular">{value}</div></div>;
}
