import type { Gig } from "@/lib/types";
import { GIG_STATUS_LABEL } from "@/lib/types";
import { longDate, money } from "@/lib/format";
import { nextBookingAction } from "@/lib/booking-workflow";
import { ArrowUpRight } from "lucide-react";

/** The same recorded facts in every saved booking card and display mode. */
export function BookingSummary({ gig, today }: { gig: Gig; today: string }) {
  return <div className="space-y-3 text-xs">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="break-words text-sm font-bold">{gig.venue || gig.name}</div><div className="mt-1 text-muted">{gig.city || "Location not entered"}</div></div>
      <ArrowUpRight className="size-4 shrink-0 text-muted" />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="rounded-md border border-line bg-surface-2 px-2 py-1 font-semibold">{GIG_STATUS_LABEL[gig.status]}</span>
      <span className="font-semibold tabular">{gig.fee > 0 ? money(gig.fee) : "Fee not entered"}</span>
    </div>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3 text-muted">
      <Fact label={gig.status === "booked" || gig.status === "completed" ? "Confirmed date" : "Proposed date"} value={gig.date ? longDate(gig.date) : "Not entered"} />
      <Fact label="Capacity" value={gig.venueCapacity ? gig.venueCapacity.toLocaleString() + (gig.capacitySourceUrl ? " · source cited" : " · unverified") : "Unavailable"} />
      <Fact label="Booking contact" value={gig.bookingContactName ? gig.bookingContactName + (gig.bookingContactSourceUrl ? " · cited source" : " · unverified") : gig.outreachContact ? gig.outreachContact + " · manually recorded" : "Unavailable"} />
      <Fact label="Booking route" value={gig.bookingRoute ? "Recorded route · review evidence" : "Not verified"} />
      <Fact label="Last communication" value={gig.outreachLastContactedAt || "Not recorded"} />
      <Fact label="Next follow-up" value={gig.outreachNextFollowUp || "Not scheduled"} />
    </dl>
    {gig.outreachReplyStatus && <p className="text-info">Reply: {gig.outreachReplyStatus}{gig.outreachReplyReceivedAt ? " · " + gig.outreachReplyReceivedAt : ""}</p>}
    <div className="rounded-lg border border-line bg-surface-2/50 p-3 leading-relaxed">
      <div className="font-semibold text-muted">Next action</div>
      <div className="mt-1 font-semibold">{nextBookingAction(gig, today)}</div>
      {gig.outreachNotes && <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-muted">Conversation / deal: {gig.outreachNotes}</p>}
      {gig.notes && <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-muted">Notes: {gig.notes}</p>}
      <div className="mt-2 font-semibold text-accent">Open complete booking workspace ↗</div>
    </div>
    <p className="text-muted">{gig.venueResearchedAt ? "Research attempted: " + gig.venueResearchedAt.slice(0, 10) : "Research not yet completed"}. Sources require review; availability and terms are not inferred.</p>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt>{label}</dt><dd className="mt-0.5 break-words font-medium text-fg">{value}</dd></div>;
}
