import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, Route as RouteIcon, Wallet } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui/card";
import { money, longDate } from "@/lib/format";
import { summarizeTour } from "@/lib/tour-economics";
import { useMusician } from "@/lib/store";

export const Route = createFileRoute("/tour")({ component: TourPage });

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight tabular">{value}</div>
      <div className="mt-1 text-xs text-muted">{detail}</div>
    </Card>
  );
}

function TourPage() {
  const gigs = useMusician((s) => s.gigs);
  const entries = useMusician((s) => s.money);
  const merchSales = useMusician((s) => s.merchSales);
  const merchProducts = useMusician((s) => s.merchProducts);
  const merchOrders = useMusician((s) => s.merchOrders);
  const merchRefunds = useMusician((s) => s.merchRefunds);

  const tour = useMemo(() => {
    const stops = gigs
      .filter((gig) => ["hold", "booked", "completed"].includes(gig.status))
      .map((gig) => {
        const costs = entries
          .filter((entry) => entry.gigId === gig.id && entry.type === "cost")
          .reduce((sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0), 0);
        const netRecordedCosts = Math.max(0, costs);
        return {
          id: gig.id,
          label: [gig.venue || gig.name, gig.city].filter(Boolean).join(" · "),
          date: gig.date,
          expectedGuarantee: Math.max(0, Number.isFinite(gig.fee) ? gig.fee : 0),
          expectedDoor: 0,
          expectedMerch: 0,
          travelCost: 0,
          lodgingCost: 0,
          crewCost: 0,
          productionCost: 0,
          otherCosts: netRecordedCosts,
          confidence: Math.min(1, Math.max(0, Number.isFinite(gig.conf) ? gig.conf : 0)),
        };
      });
    return summarizeTour(stops);
  }, [gigs, entries]);

  const actualMerch = useMemo(
    () => summarizeMerch(merchProducts, merchSales, merchOrders, merchRefunds),
    [merchProducts, merchSales, merchOrders, merchRefunds],
  );
  const actualMerchRevenue = actualMerch.netSales;
  const actualMerchProfit = actualMerch.grossProfit;
  const actualMerchUnits = actualMerch.unitsSold;
  const merchByGig = new Map<string, { revenue: number; grossProfit: number; units: number }>();
  for (const gig of gigs) {
    const summary = summarizeMerch(
      merchProducts,
      merchSales.filter((sale) => sale.gigId === gig.id),
      merchOrders,
      merchRefunds,
    );
    if (summary.unitsSold || summary.netSales || summary.grossProfit) {
      merchByGig.set(gig.id, {
        revenue: summary.netSales,
        grossProfit: summary.grossProfit,
        units: summary.unitsSold,
      });
    }
  }

  const stopsByDate = [...tour.stops].sort((a, b) => {
    const aDate = gigs.find((gig) => gig.id === a.id)?.date ?? "";
    const bDate = gigs.find((gig) => gig.id === b.id)?.date ?? "";
    return aDate.localeCompare(bDate);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Tour operations</Eyebrow>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">Tour economics</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            Compare held, booked, and completed shows to see where the route's estimated economics are strongest.
          </p>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2">
          <RouteIcon className="size-5 text-accent" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Expected gross" value={money(tour.expectedGross)} detail="Gig fees entered in your pipeline" />
        <Metric label="Recorded costs" value={money(tour.expectedCosts)} detail="Expenses linked to these shows" />
        <Metric label="Expected net" value={money(tour.expectedNet)} detail="Gross minus linked costs" />
        <Metric label="Risk-adjusted net" value={money(tour.riskAdjustedNet)} detail="Net weighted by each gig's confidence" />
        <Metric label="Actual merch sales" value={money(actualMerchRevenue)} detail={`${actualMerchUnits} units recorded`} />
        <Metric label="Merch gross profit" value={money(actualMerchProfit)} detail="Recorded sales less saved item costs" />
      </div>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 size-4 shrink-0 text-accent" />
          <div>
            <div className="text-sm font-semibold">What these numbers mean</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Expected show economics use saved gig fees and confidence plus linked expenses. Actual merch sales are reported separately from projected show income, and show-linked merch is attributed only when you link a sale to a gig. Fuel, lodging, taxes, door deals, and unrecorded merch are not guessed.
            </p>
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Tour stops</h3>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{tour.stopCount} stops</span>
        </div>

        {stopsByDate.length === 0 ? (
          <Card className="p-5">
            <div className="text-sm font-semibold">Your tour plan starts here.</div>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Add shows to your pipeline, then move serious opportunities to Hold or Booked. This page will compare their expected economics automatically.
            </p>
            <Link to="/gigs" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:opacity-80">
              Open gig pipeline <ArrowUpRight className="size-4" />
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {stopsByDate.map((stop) => {
              const gig = gigs.find((item) => item.id === stop.id);
              const status = gig?.status ?? "lead";
              const merch = merchByGig.get(stop.id);
              return (
                <Card key={stop.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{gig?.name || stop.label}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{[gig?.venue, gig?.city].filter(Boolean).join(" · ") || "Venue details needed"}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted">{longDate(gig?.date)} · {status}</div>
                    {merch && <div className="mt-1 text-xs font-medium text-accent">Merch: {money(merch.revenue)} sales · {merch.units} units · {money(merch.grossProfit)} gross profit</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold tabular">{money(stop.expectedNet)}</div>
                      <div className="mt-1 text-[10px] text-muted">est. net</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Gross</div>
                      <div className="mt-1 text-xs font-semibold tabular">{money(stop.expectedGross)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Costs</div>
                      <div className="mt-1 text-xs font-semibold tabular">{money(stop.expectedCosts)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Confidence</div>
                      <div className="mt-1 text-xs font-semibold tabular">{Math.round(stop.confidence * 100)}%</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
