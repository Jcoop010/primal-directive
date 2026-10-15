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
  const lowStock = data.merchProducts.filter((product) => product.active && product.stockOnHand <= product.reorderAt);
  if (lowStock.length) items.push({
    id: "merch", priority: "important", title: `${lowStock.length} merch item${lowStock.length === 1 ? "" : "s"} low on stock`,
    detail: "Review inventory before the next show.", href: "/merch",
  });
  const leads = data.gigs.filter((gig) => ["lead", "outreach", "negotiating", "hold"].includes(gig.status));
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
