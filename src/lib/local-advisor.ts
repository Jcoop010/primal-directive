import type { SuggestedGig, SuggestedPerson } from "@/lib/types";

export type LocalAdvice = {
  answer: string;
  source: string;
  gigs: SuggestedGig[];
  people: SuggestedPerson[];
  moves: string[];
};

/**
 * Conservative offline fallback. It deliberately does not generate real-world
 * names, dates, venues, contact details, availability, capacities, or fees.
 * Those claims require a live, source-backed advisor response.
 */
export function localGrowthAdvice(message: string, context: string): LocalAdvice {
  const q = message.toLowerCase();
  const artist = pick(context, /^ARTIST:\s*(.*)$/m) || "the artist";
  const home = pick(context, /^HOME:\s*(.*)$/m) || "your home market";
  const genre = pick(context, /^GENRE:\s*(.*)$/m) || "your sound";
  const draw = pick(context, /^TYPICAL DRAW:\s*(.*)$/m) || "your current draw";
  const fee = pick(context, /^FEE TARGET:\s*(.*)$/m) || "not set";

  let focus: string;
  let moves: string[];

  if (/(contact|booker|promoter|email|phone|venue|room|gig|show|booking|available|availability|lineup|bill|tour|rout|date|guarantee|fee)/.test(q)) {
    focus = `I can't verify live venue calendars, lineups, booking contacts, availability, room capacities, or guarantees while live search is unavailable. I won't invent a venue lead or put an unverified person/date into your pipeline.

For ${artist} in ${home}, the responsible next step is to use your saved pipeline as the starting point: identify the highest-priority open opportunity, verify its official venue page and current booking contact, then confirm the date and deal terms directly before changing its status. Your recorded draw is ${draw}; your fee target is ${fee}. Those are profile inputs, not independently verified market benchmarks.`;
    moves = [
      "Choose the highest-value open opportunity already in the saved pipeline.",
      "Verify the venue's official site, current booking contact, and recent comparable bills; record the source URL.",
      "Do not mark a show booked or enter a guarantee until the venue confirms terms in writing.",
    ];
  } else if (/(merch|inventory|stock|margin|profit|shirt|product|price)/.test(q)) {
    focus = `I can help reason from the inventory and sales figures saved in Primal Directive, but I can't validate outside market prices in offline mode. For ${artist}, prioritize contribution margin and sell-through rather than revenue alone: compare unit price minus unit cost, units sold by channel, and remaining stock. Treat any missing cost or stock count as unknown, not zero.`;
    moves = [
      "Check that each active product has a current unit cost, selling price, and physical stock count.",
      "Rank products by gross profit and sell-through, not total sales alone.",
      "Reorder only after comparing remaining stock with recent sales velocity and lead time.",
    ];
  } else if (/(post|content|tiktok|instagram|social|video|fan|audience|draw|growth|promot)/.test(q)) {
    focus = `For ${artist} (${genre}) in ${home}, use content to move fans toward an observable action rather than chasing views alone. Track link clicks, email/SMS signups, ticket conversions, and merch sales by post when possible. Your recorded draw is ${draw}; use actual attendance and ticket data to measure growth instead of guessing.`;
    moves = [
      "Publish one strong live clip with a specific next-show or email-list call to action.",
      "Use a unique tracked link or signup prompt so the result can be measured.",
      "Review results after 7 days and repeat the format that produces real fan actions.",
    ];
  } else {
    focus = `Offline mode is active: I can offer a strategy, but I can't confirm current external facts until live search works again. For ${artist}, the useful baseline is the saved profile and pipeline: ${genre}, home market ${home}, recorded draw ${draw}, fee target ${fee}. These are app-recorded inputs, not independent proof.

Start with the nearest measurable bottleneck: confirmed dates, audience conversion, merch margin, or overdue follow-ups. Pick the bottleneck supported by actual records, then run one small test and measure the result before scaling.`;
    moves = [
      "Review the saved pipeline and identify the single bottleneck with the clearest evidence.",
      "Choose one measurable action for this week and set a numeric success target.",
      "Update the app with actual outcomes so future advice can use evidence instead of assumptions.",
    ];
  }

  return {
    source: "OFFLINE MODE — LIVE FACTS NOT VERIFIED",
    answer: focus,
    gigs: [],
    people: [],
    moves: moves.slice(0, 3),
  };
}

function pick(context: string, re: RegExp): string | undefined {
  return context.match(re)?.[1]?.trim();
}
