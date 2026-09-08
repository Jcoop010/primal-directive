import { parseDay } from "@/lib/format";
import { pipelineGigs, sumMoney } from "@/lib/store";
import type { Gig, MoneyEntry, Person } from "@/lib/types";

export type Signal = {
  id: string;
  tone: "live" | "warn" | "info";
  title: string;
  detail: string;
  href?: string;
};

export function deriveSignals(
  gigs: Gig[],
  money: MoneyEntry[],
  _people: Person[],
): Signal[] {
  const out: Signal[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = gigs
    .filter((g) => g.date && g.status !== "passed")
    .map((g) => ({ g, d: parseDay(g.date) }))
    .filter(({ d }) => {
      const diff = (d.getTime() - today.getTime()) / 86400000;
      return diff >= 0 && diff <= 10;
    })
    .sort((a, b) => a.d.getTime() - b.d.getTime());

  if (upcoming[0]) {
    const { g, d } = upcoming[0];
    const days = Math.round((d.getTime() - today.getTime()) / 86400000);
    out.push({
      id: `soon-${g.id}`,
      tone: days <= 3 ? "warn" : "live",
      title: days === 0 ? `${g.venue} is today` : `${g.venue} in ${days} day${days === 1 ? "" : "s"}`,
      detail: `${g.name} · ${g.city}`,
      href: "/gigs",
    });
  }

  const outstanding = sumMoney(money, "outstanding");
  if (outstanding > 0) {
    out.push({
      id: "unpaid",
      tone: "warn",
      title: `$${outstanding.toLocaleString()} still outstanding`,
      detail: "Chase deposits and remainders before the next routing week.",
      href: "/money",
    });
  }

  const soft = pipelineGigs(gigs).filter(
    (g) => g.conf < 0.45 && (g.fee || 0) >= 800,
  );
  if (soft[0]) {
    out.push({
      id: `soft-${soft[0].id}`,
      tone: "info",
      title: `Low-confidence $${soft[0].fee.toLocaleString()} hold`,
      detail: `${soft[0].venue} needs a follow-up or a full bill attached.`,
      href: "/gigs",
    });
  }

  const outreach = gigs.filter((g) => g.status === "outreach" || g.status === "lead");
  if (outreach.length >= 2) {
    out.push({
      id: "pipeline-move",
      tone: "info",
      title: `${outreach.length} leads waiting on a move`,
      detail: "Pick one room and send a one-sheet this week. Volume without follow-up is noise.",
      href: "/gigs",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "quiet",
      tone: "live",
      title: "No urgent signals",
      detail: "Use the advisor to build the next 30-day pursuit list.",
      href: "/",
    });
  }

  return out.slice(0, 4);
}
