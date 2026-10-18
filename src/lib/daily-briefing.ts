import { ACTIVE_BOOKING_STATUSES } from "./types.ts";
import type { Gig, MoneyEntry, OperationalTask, MerchProduct } from "./types";

export type BriefingItem = {
  id: string;
  priority: "urgent" | "important" | "opportunity";
  title: string;
  detail: string;
  href: "/tasks" | "/gigs" | "/money" | "/merch" | "/calendar";
};

export function buildDailyBriefing(
  data: { gigs: Gig[]; tasks: OperationalTask[]; money: MoneyEntry[]; merchProducts: MerchProduct[] },
  today: string,
): BriefingItem[] {
  const items: BriefingItem[] = [];
  const openTasks = data.tasks.filter((task) => task.status === "open");
  const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < today);
  if (overdue.length) items.push({
    id: "overdue", priority: "urgent", title: `${overdue.length} overdue action${overdue.length === 1 ? "" : "s"}`,
    detail: "Review overdue show preparation and booking tasks.", href: "/tasks",
  });
  const outstanding = data.money.filter((entry) => entry.type === "outstanding").reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  if (outstanding > 0) items.push({
    id: "collections", priority: "important", title: `$${Math.round(outstanding).toLocaleString("en-US")} to collect`,
    detail: "Review recorded outstanding payments and reconcile settled shows.", href: "/money",
  });
  const nextShow = data.gigs.filter((gig) => gig.status === "booked" && gig.date >= today && /^\d{4}-\d{2}-\d{2}$/.test(gig.date)).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (nextShow) {
    const pending = openTasks.filter((task) => task.gigId === nextShow.id && task.dueDate <= nextShow.date);
    items.push({
      id: "next-show", priority: pending.length ? "important" : "opportunity",
      title: `Next show: ${nextShow.venue || nextShow.name}`,
      detail: `${nextShow.date} · ${nextShow.city || "Location TBD"} · ${pending.length} preparation task${pending.length === 1 ? "" : "s"} open.`,
      href: pending.length ? "/tasks" : "/calendar",
    });
  }
  const followUps = data.gigs.filter((gig) => ACTIVE_BOOKING_STATUSES.includes(gig.status) && gig.outreachNextFollowUp && gig.outreachNextFollowUp <= today).sort((a, b) => (a.outreachNextFollowUp || "").localeCompare(b.outreachNextFollowUp || ""));
  if (followUps.length) {
    const overdueFollowUps = followUps.filter((gig) => (gig.outreachNextFollowUp || "") < today).length;
    items.push({
      id: "booking-followups", priority: overdueFollowUps ? "urgent" : "important",
      title: `${followUps.length} booking follow-up${followUps.length === 1 ? "" : "s"} due`,
      detail: `${overdueFollowUps ? `${overdueFollowUps} overdue. ` : ""}Next: ${followUps[0].venue || followUps[0].name}. Review outreach notes and contact details before following up; no messages are sent automatically.`,
      href: "/gigs",
    });
  }
  const replies = data.gigs.filter(gig => ACTIVE_BOOKING_STATUSES.includes(gig.status) && (gig.status === "responded" || gig.outreachReplyStatus === "interested"));
  if (replies.length) items.push({ id: "booking-replies", priority: "important", title: `${replies.length} booking repl${replies.length === 1 ? "y" : "ies"} to review`, detail: `Start with ${replies[0].venue || replies[0].name}. Read the saved conversation and prepare a response for approval.`, href: "/gigs" });
  const negotiations = data.gigs.filter(gig => gig.status === "negotiating");
  if (negotiations.length) items.push({ id: "booking-negotiations", priority: "important", title: `${negotiations.length} negotiation${negotiations.length === 1 ? "" : "s"} awaiting a decision`, detail: `Review proposed terms for ${negotiations[0].venue || negotiations[0].name}. No date or financial commitment is accepted automatically.`, href: "/gigs" });
  const holds = data.gigs.filter(gig => gig.status === "hold").sort((a,b) => (a.date || "9999").localeCompare(b.date || "9999"));
  if (holds.length) items.push({ id: "booking-holds", priority: "important", title: `${holds.length} hold${holds.length === 1 ? "" : "s"} to confirm`, detail: `${holds[0].venue || holds[0].name} · ${holds[0].date || "Date missing"}. Confirm hold expiry and conditions directly with the venue.`, href: "/gigs" });
  const unsourcedLeads = data.gigs.filter((gig) => ACTIVE_BOOKING_STATUSES.includes(gig.status) && !gig.researchSourceUrl && !gig.researchVerifiedAt);
  if (unsourcedLeads.length) items.push({
    id: "verify-research", priority: "opportunity",
    title: `${unsourcedLeads.length} booking lead${unsourcedLeads.length === 1 ? "" : "s"} need source review`,
    detail: "Add research sources and verify venue details before treating leads as confirmed opportunities.",
    href: "/gigs",
  });
  const lowStock = data.merchProducts.filter((product) => product.active && product.stockOnHand <= product.reorderAt);
  if (lowStock.length) items.push({
    id: "merch", priority: "important", title: `${lowStock.length} merch item${lowStock.length === 1 ? "" : "s"} low on stock`,
    detail: "Review inventory before the next show.", href: "/merch",
  });
  const leads = data.gigs.filter((gig) => ACTIVE_BOOKING_STATUSES.includes(gig.status));
  if (leads.length) items.push({
    id: "pipeline", priority: "opportunity", title: `${leads.length} booking opportunit${leads.length === 1 ? "y" : "ies"} in progress`,
    detail: "Review open conversations and prepare your next outreach.", href: "/gigs",
  });
  if (!items.length) items.push({
    id: "ready", priority: "opportunity", title: "Your workspace is ready",
    detail: "Add a booking opportunity or confirm a show to start receiving actionable briefings.", href: "/gigs",
  });
  const weight = { urgent: 0, important: 1, opportunity: 2 };
  return items.sort((a, b) => weight[a.priority] - weight[b.priority]);
}
