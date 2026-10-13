import type { SuggestedGig, SuggestedPerson } from "@/lib/types";

export type LocalAdvice = {
  answer: string;
  source: string;
  gigs: SuggestedGig[];
  people: SuggestedPerson[];
  moves: string[];
};

type PipelineItem = {
  raw: string;
  status: string;
  fee: number;
  confidence: number;
};

const OPEN_STATUSES = new Set(["lead", "outreach", "negotiating", "hold"]);
const STATUS_PRIORITY: Record<string, number> = {
  negotiating: 0,
  outreach: 1,
  lead: 2,
  hold: 3,
};

/**
 * Conservative offline fallback. It never generates real-world leads.
 * It can still prioritize an opportunity explicitly present in the supplied
 * saved pipeline context, while clearly labeling it as app-recorded rather
 * than externally verified.
 */
export function localGrowthAdvice(message: string, context: string): LocalAdvice {
  const q = message.toLowerCase();
  const artist = pick(context, /^ARTIST:\s*(.*)$/m);
  const home = pick(context, /^HOME:\s*(.*)$/m);
  const genre = pick(context, /^GENRE:\s*(.*)$/m);
  const draw = pick(context, /^TYPICAL DRAW:\s*(.*)$/m);
  const fee = pick(context, /^FEE TARGET:\s*(.*)$/m);
  const pipeline = parsePipeline(context);
  const bestOpen = pipeline
    .filter((item) => OPEN_STATUSES.has(item.status))
    .sort((a, b) =>
      (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99) ||
      b.fee - a.fee ||
      b.confidence - a.confidence,
    )[0];

  let focus: string;
  let moves: string[];

  const asksMerch = /(merch|inventory|stock|shirt|product|sell-through)/.test(q);
  const asksFinance = /(financial|finance|revenue|income|expense|cash flow|profit|settlement|payout|money|collected|outstanding|\bspent\b|\bearned\b|\bmade\b)/.test(q) && !asksMerch;

  const asksGigFinance = /(by gig|per gig|each gig|which gigs?|show[- ]level|tour profitability|profit.*gig|gig.*profit)/.test(q);

  if (asksFinance && asksGigFinance) {
    focus = "I can see the overall recorded money totals, but the context supplied to the offline advisor does not include a reconciled income-and-cost breakdown for each gig. I can’t reliably rank gig profitability from pipeline fees alone: those fees may be unconfirmed, and expenses may not be linked to the right show. Link collected income and every relevant cost to each gig in Money, then reconcile settlement before comparing shows.";
    moves = [
      "Open each completed gig and confirm its actual collected income, not its proposed fee.",
      "Link travel, lodging, production, and other costs to the correct gig where applicable.",
      "Reconcile the final settlement, then compare collected income minus recorded gig costs.",
    ];
  } else if (asksFinance) {
    const moneyLine = context.match(/^MONEY:.*$/m)?.[0];
    const readAmount = (label: string): number | undefined => {
      if (!moneyLine) return undefined;
      const match = moneyLine.match(new RegExp(`(?:^|[, ])${label}\\s+(-?\\d+(?:\\.\\d+)?)`, "i"));
      if (!match) return undefined;
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : undefined;
    };
    const collected = readAmount("collected");
    const outstanding = readAmount("outstanding");
    const costs = readAmount("costs");
    const profit = readAmount("profit");
    const money = (value: number) => new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);

    if (collected !== undefined && outstanding !== undefined && costs !== undefined && profit !== undefined) {
      focus = `App-recorded financial summary (not independently verified against bank statements):\n- Collected: ${money(collected)}\n- Outstanding: ${money(outstanding)}\n- Recorded costs: ${money(costs)}\n- Recorded profit: ${money(profit)} (collected minus recorded costs, as calculated by the app).\n\nImportant limits: outstanding amounts are not collected cash; pipeline fees are not guaranteed revenue; and unrecorded transactions or missing costs can make the real result different. These totals describe the records supplied to the advisor, not a verified tax figure or bank balance.`;
      moves = [
        "Reconcile collected and outstanding amounts against invoices and payments received.",
        "Review uncategorized or missing expenses before relying on the profit figure.",
        "For a gig-level result, link each income and cost entry to the correct gig and reconcile after settlement.",
      ];
    } else {
      focus = "I can't calculate a trustworthy financial summary because one or more required totals are missing from the context supplied to the advisor. I won't fill the gaps with guesses. Open the Money view, verify collected income, outstanding amounts, and recorded costs, then ask again.";
      moves = [
        "Open Money and verify the income and cost entries are recorded.",
        "Mark amounts as collected only after payment is received; keep unpaid amounts outstanding.",
        "Re-run the summary after the records are complete.",
      ];
    }
  } else if (/(contact|booker|promoter|email|phone|venue|room|gig|show|booking|available|availability|lineup|bill|tour|rout|date|guarantee|fee)/.test(q)) {
    const profile = [
      artist ? `Artist: ${artist}.` : "",
      home ? `Home market: ${home}.` : "",
      genre ? `Genre: ${genre}.` : "",
      draw ? `Recorded typical draw: ${draw}.` : "",
      fee ? `Current profile fee target: ${fee} (a profile input, not a market benchmark).` : "",
    ].filter(Boolean).join(" ");

    if (bestOpen) {
      focus = `I can't verify live venue calendars, lineups, booking contacts, availability, room capacities, or guarantees while live search is unavailable. I won't invent a venue lead or treat an unverified date or deal as confirmed.

The highest-priority open item I can identify in the saved pipeline is: ${bestOpen.raw}. This is copied from the app's supplied pipeline context; I have not independently verified it with the venue. ${profile ? profile + " " : ""}Confirm the official venue page and current booking contact, then get the date and deal terms in writing before changing the status.`;
      moves = [
        `Open the existing pipeline record: ${bestOpen.raw.split("|")[0].replace(/^-\s*/, "").trim()}.`,
        "Verify the official venue page and current booking contact; save the source URL on the record.",
        "Ask the venue to confirm the date, billing, guarantee or door split, and payment terms in writing before updating status.",
      ];
    } else {
      focus = `I can't verify live venue calendars, lineups, booking contacts, availability, room capacities, or guarantees while live search is unavailable. I won't invent a venue lead or put an unverified person/date into your pipeline.

I couldn't identify an open opportunity in the pipeline context provided to the advisor. That does not prove your pipeline is empty; it means I don't have an open record I can safely prioritize from this context. ${profile ? profile : "Artist profile details are not available in the supplied context."} Open the Gigs/Board view and choose an existing lead or outreach item to review. Don't mark a show booked or enter a guarantee until the venue confirms terms in writing.`;
      moves = [
        "Open Gigs or Board and find an existing item with status Lead, Outreach, Negotiating, or Hold.",
        "Check that the record has a venue, city, next action, and source URL; fill only details you can verify.",
        "Confirm date and deal terms directly with the venue before marking the show booked.",
      ];
    }
  } else if (/(merch|inventory|stock|margin|profit|shirt|product|price)/.test(q)) {
    focus = `I can help reason from the inventory and sales figures saved in Primal Directive, but I can't validate outside market prices in offline mode. ${artist ? `For ${artist}, ` : ""}prioritize contribution margin and sell-through rather than revenue alone: compare unit price minus unit cost, units sold by channel, and remaining stock. Treat any missing cost or stock count as unknown, not zero.`;
    moves = [
      "Check that each active product has a current unit cost, selling price, and physical stock count.",
      "Rank products by gross profit and sell-through, not total sales alone.",
      "Reorder only after comparing remaining stock with recent sales velocity and lead time.",
    ];
  } else if (/(post|content|tiktok|instagram|social|video|fan|audience|draw|growth|promot)/.test(q)) {
    const identity = [artist, genre ? `(${genre})` : "", home ? `in ${home}` : ""].filter(Boolean).join(" ");
    focus = `${identity ? `For ${identity}, ` : ""}use content to move fans toward an observable action rather than chasing views alone. Track link clicks, email/SMS signups, ticket conversions, and merch sales by post when possible. ${draw ? `Your recorded draw is ${draw}; use actual attendance and ticket data to measure growth instead of guessing.` : "Your typical draw is not available in the supplied profile context, so don't infer a number."}`;
    moves = [
      "Publish one strong live clip with a specific next-show or email-list call to action.",
      "Use a unique tracked link or signup prompt so the result can be measured.",
      "Review results after 7 days and repeat the format that produces real fan actions.",
    ];
  } else {
    const profile = [
      artist ? `artist ${artist}` : "",
      genre ? `genre ${genre}` : "",
      home ? `home market ${home}` : "",
      draw ? `recorded draw ${draw}` : "",
      fee ? `current profile fee target ${fee}` : "",
    ].filter(Boolean).join("; ");
    focus = `Offline mode is active: I can offer strategy, but I can't confirm current external facts until live search works again. ${profile ? `Available profile inputs: ${profile}. These are app-recorded values, not independently verified market facts.` : "Artist profile details are not available in the supplied context."}

Start with the nearest measurable bottleneck supported by actual records: confirmed dates, audience conversion, merch margin, or overdue follow-ups. Pick one test and measure the result before scaling.`;
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
  const value = context.match(re)?.[1]?.trim();
  return value || undefined;
}

function parsePipeline(context: string): PipelineItem[] {
  const section = context.split(/GIG PIPELINE:\s*\n/i)[1]?.split(/\n(?:PEOPLE|MERCH INVENTORY|MONEY|MERCH):/i)[0];
  if (!section || section.trim() === "(empty)") return [];

  return section.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("- ")).map((raw) => {
    const fields = raw.slice(2).split("|").map((field) => field.trim());
    const feeText = fields[2] ?? "";
    const confidenceText = fields[4] ?? "";
    const fee = Number(feeText.replace(/[^\d.-]/g, "")) || 0;
    const confidence = Number(confidenceText.replace(/[^\d.-]/g, "")) || 0;
    return {
      raw,
      status: (fields[3] ?? "").toLowerCase(),
      fee,
      confidence,
    };
  });
}
