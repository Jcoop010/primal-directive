import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, Eyebrow } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { calculateSettlement, type SettlementMember, type ShowFinancialLine } from "@/lib/band-ops";
import { money, longDate, downloadCsv } from "@/lib/format";
import { useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settlement")({ component: SettlementPage });

function SettlementPage() {
  const gigs = useMusician((s) => s.gigs);
  const people = useMusician((s) => s.people);
  const entries = useMusician((s) => s.money);
  const profile = useMusician((s) => s.profile);
  const updatePerson = useMusician((s) => s.updatePerson);
  const updateProfile = useMusician((s) => s.updateProfile);
  const [gigId, setGigId] = useState("");
  const [reserve, setReserve] = useState(String(profile.reservePercent ?? 10));
  const band = people.filter((p) => p.role === "band");
  const lines = useMemo<ShowFinancialLine[]>(() => {
    const gig = gigs.find((g) => g.id === gigId);
    const ledger = entries.filter((entry) => entry.gigId === gigId);
    const result: ShowFinancialLine[] = ledger.map((entry) => ({
      label: entry.label,
      amount: entry.amount,
      kind: entry.type === "cost" ? "expense" : "income",
      status: entry.type === "outstanding" ? "expected" : "actual",
    }));
    if (gig && !ledger.some((entry) => entry.type === "collected" && /guarantee|fee/i.test(entry.label))) {
      result.push({ label: "Gig fee (not yet confirmed collected)", amount: gig.fee, kind: "income", status: "expected" });
    }
    return result;
  }, [entries, gigId, gigs]);
  const members: SettlementMember[] = band.map((person, index) => ({
    id: person.id,
    name: person.name,
    sharePercent: person.settlementSharePercent ?? (band.length ? Math.floor(100 / band.length) + (index < 100 % band.length ? 1 : 0) : 0),
  }));
  let result: ReturnType<typeof calculateSettlement> | null = null;
  let calculationError = "";
  try {
    if (members.length && gigId) result = calculateSettlement(lines, members, Number(reserve));
  } catch (error) {
    calculationError = error instanceof Error ? error.message : "Check member splits and reserve.";
  }
  const selectedGig = gigs.find((gig) => gig.id === gigId);

  return <div className="space-y-4">
    <div className="px-1"><Eyebrow>Show settlement</Eyebrow><h1 className="font-display text-2xl font-bold">Close the night. Know the numbers.</h1><p className="mt-1 text-sm text-muted">Build a reviewable payout proposal from the selected show’s ledger. Nothing is paid automatically.</p></div>
    <Card className="space-y-3">
      <label className="block text-xs font-semibold text-muted">Select gig
        <select value={gigId} onChange={(e) => setGigId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-3 text-sm text-fg">
          <option value="">Choose a show…</option>{gigs.map((gig) => <option key={gig.id} value={gig.id}>{gig.date || "Date TBD"} · {gig.name} — {gig.venue}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-muted">Band reserve (% of positive actual net)
        <input type="number" min="0" max="100" step="1" value={reserve} onChange={(e) => setReserve(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-3 text-sm text-fg" />
      </label>
      <button type="button" onClick={() => { const value=Number(reserve); if (!Number.isFinite(value)||value<0||value>100) { toast.error("Reserve must be between 0 and 100%."); return; } updateProfile({ reservePercent:value }); toast.success("Default reserve saved."); }} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold">Save default reserve</button>
      {selectedGig && <p className="text-xs text-muted">Gig fee: {money(selectedGig.fee)} · {longDate(selectedGig.date)}. A fee is treated as expected unless a matching collected ledger entry exists.</p>}
    </Card>
    {!gigId ? <Card><h2 className="font-semibold">Start with a show</h2><p className="mt-1 text-sm text-muted">Select a gig to reconcile income, costs, reserve, and proposed member payouts.</p></Card> : <>
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Actual income" value={money(result?.actualIncome ?? 0)} hint="recorded as collected" />
        <MetricCard label="Actual costs" value={money(result?.actualExpenses ?? 0)} hint="linked cost entries" />
        <MetricCard label="Actual net" value={money(result?.actualNet ?? 0)} hint="before reserve" />
        <MetricCard label="Proposed payouts" value={money(result?.distributableAmount ?? 0)} hint="after reserve" />
      </div>
      <Card className="space-y-3">
        <div><h2 className="font-display text-lg font-bold">Member splits</h2><p className="mt-1 text-xs text-muted">Edit each person’s share. Shares must total exactly 100% to calculate a payout.</p></div>
        {band.length===0 ? <p className="text-sm text-muted">Add each band member under People and set their role to Band first.</p> : band.map((person,index) => <label key={person.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{person.name}</span><span className="text-xs text-muted">Proposed: {money(result?.payouts.find((p)=>p.memberId===person.id)?.amount ?? 0)}</span></span><span className="flex items-center gap-2"><input aria-label={person.name+" share percent"} type="number" min="0" max="100" step="0.1" defaultValue={members[index]?.sharePercent ?? 0} onBlur={(e)=>{const value=Number(e.currentTarget.value); if(!Number.isFinite(value)||value<0||value>100){toast.error("Share must be between 0 and 100%.");return;} updatePerson(person.id,{settlementSharePercent:value});}} className="w-20 rounded-lg border border-line bg-bg px-2 py-2 text-right text-sm" /><span className="text-xs text-muted">%</span></span></label>)}
        {calculationError && <p className="rounded-lg border border-danger/40 p-3 text-sm text-danger">{calculationError}</p>}
        {result && result.deficit>0 && <p className="rounded-lg border border-danger/40 p-3 text-sm text-danger">This show has a recorded deficit of {money(result.deficit)}. No payouts are proposed.</p>}
        {result && <button type="button" onClick={()=>downloadCsv("primal-directive-settlement.csv",[["Show","Date","Actual income","Actual costs","Actual net","Reserve percent","Reserve amount","Distributable"],[selectedGig?.name ?? "",selectedGig?.date ?? "",String(result!.actualIncome),String(result!.actualExpenses),String(result!.actualNet),String(result!.reservePercent),String(result!.reserveAmount),String(result!.distributableAmount)],[],["Member","Share percent","Proposed payout"],...result!.payouts.map(p=>[p.memberName,String(p.sharePercent),String(p.amount)])])} className={cn("w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold text-accent-fg",!result && "opacity-50")}>Export settlement review (CSV)</button>}
        <p className="text-[11px] leading-relaxed text-muted">Review before paying. This tool does not initiate transfers, handle tax withholding, resolve disputed costs, or record payout completion. Only linked ledger entries are included; avoid entering merch revenue twice.</p>
      </Card>
    </>}
  </div>;
}
