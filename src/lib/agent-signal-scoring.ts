export const SIGNAL_PRIORITIES = ["high", "medium", "low"] as const;
export type SignalPriorityTier = (typeof SIGNAL_PRIORITIES)[number];

export const SIGNAL_URGENCIES = ["urgent", "high", "normal", "low"] as const;
export type SignalUrgency = (typeof SIGNAL_URGENCIES)[number];

export const SIGNAL_SORTS = ["score", "newest"] as const;
export type SignalSortMode = (typeof SIGNAL_SORTS)[number];

export const SIGNAL_BILL_ROLES = ["support", "co_bill", "headliner", "festival", "session"] as const;
export type SignalBillRole = (typeof SIGNAL_BILL_ROLES)[number];

export const SIGNAL_DEAL_TYPES = ["guarantee", "door_split", "versus", "promo_showcase"] as const;
export type SignalDealType = (typeof SIGNAL_DEAL_TYPES)[number];

export const SIGNAL_BOOKING_STAGES = [
  "lead",
  "hold_requested",
  "hold_confirmed",
  "advance_in_progress",
  "booked",
  "passed",
] as const;
export type SignalBookingStage = (typeof SIGNAL_BOOKING_STAGES)[number];

export interface SignalScoringInput {
  signalType: string;
  summary?: string | null;
  sourceUrl?: string | null;
  payload?: Record<string, unknown> | null;
  fitScore?: number | null;
  priorityTier?: SignalPriorityTier | null;
  urgency?: SignalUrgency | null;
  recommendedAction?: string | null;
  corridor?: string | null;
  billRole?: SignalBillRole | null;
  targetWindow?: string | null;
  dealType?: SignalDealType | null;
}

export interface NormalizedSignalScoring {
  fitScore: number;
  priorityTier: SignalPriorityTier;
  urgency: SignalUrgency;
  recommendedAction: string | null;
}

const HIGH_VALUE_BAND_TYPES = new Set([
  "booking_offer",
  "tour_support",
  "festival_slot",
  "opener_slot",
  "headliner_slot",
  "contract",
  "settlement",
  "urgent_reply",
  "venue_reply",
]);

const BAND_LEAD_TYPES = new Set([
  "venue_lead",
  "booking_lead",
  "festival_open",
  "tour_routing",
  "support_slot",
  "promoter_lead",
  "band_opportunity",
  "studio_session",
  "merch_partner",
]);

const MUSIC_INTEL_TYPES = new Set([
  "market_intel",
  "press_lead",
  "playlist_lead",
  "handoff",
  "alert",
]);

const LOW_SIGNAL_TYPES = new Set(["smoke_test", "heartbeat", "ping", "noise"]);

const RICH_BAND_PAYLOAD_KEYS = new Set([
  "venue",
  "city",
  "capacity",
  "genres",
  "bookingEmail",
  "email",
  "contact",
  "promoter",
  "billType",
  "guarantee",
  "fee",
  "deadline",
  "date",
  "targetWindow",
  "routingFit",
  "corridor",
]);

export function clampFitScore(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeUrgency(value?: string | null): SignalUrgency {
  if (value === "urgent" || value === "high" || value === "normal" || value === "low") {
    return value;
  }
  return "normal";
}

export function derivePriorityTier(fitScore: number, urgency: SignalUrgency): SignalPriorityTier {
  if (fitScore >= 75 || urgency === "urgent") return "high";
  if (fitScore >= 45) return "medium";
  return "low";
}

function defaultBandRecommendedAction(input: SignalScoringInput): string | null {
  const type = input.signalType.trim().toLowerCase();
  if (LOW_SIGNAL_TYPES.has(type)) return null;
  if (input.billRole === "festival" || type === "festival_slot" || type === "festival_open") {
    return "Convert to Lead, verify submission deadline, and send EPK + live video clip.";
  }
  if (input.billRole === "support" || type === "tour_support" || type === "opener_slot") {
    return "Convert to Lead, check corridor routing dates, and request a support hold.";
  }
  if (HIGH_VALUE_BAND_TYPES.has(type)) {
    return "Convert to Lead, confirm hold dates, and reply with EPK + guarantee terms.";
  }
  if (BAND_LEAD_TYPES.has(type)) {
    return "Convert to Lead and pitch EPK, live video link, and regional draw history.";
  }
  return null;
}

export function buildBookingOutreachDraft(input: {
  venue: string;
  city?: string | null;
  corridor?: string | null;
  billRole?: SignalBillRole | null;
  targetWindow?: string | null;
  dealType?: SignalDealType | null;
  recommendedAction?: string | null;
}): string {
  const venue = input.venue.trim() || "your room";
  const cityPart = input.city?.trim() ? ` in ${input.city.trim()}` : "";
  const roleLabel =
    input.billRole === "support"
      ? "a direct support slot"
      : input.billRole === "co_bill"
        ? "a co-bill"
        : input.billRole === "headliner"
          ? "a regional headlining date"
          : input.billRole === "festival"
            ? "an artist showcase/festival slot"
            : input.billRole === "session"
              ? "a live session"
              : "an upcoming live bill";
  const windowPart = input.targetWindow?.trim() ? ` around ${input.targetWindow.trim()}` : "";
  const corridorPart = input.corridor?.trim()
    ? ` We are routing through the ${input.corridor.trim()} corridor and would love to lock a hold.`
    : "";
  const dealPart =
    input.dealType === "guarantee"
      ? " Happy to discuss guarantee terms."
      : input.dealType === "door_split"
        ? " Open to a fair door split and local cross-promotion."
        : input.dealType === "versus"
          ? " Open to a guarantee-versus-door structure."
          : "";
  const angle = input.recommendedAction?.trim()
    ? `\n\nNotes: ${input.recommendedAction.trim()}`
    : "";

  return (
    `Hi ${venue} booking team,\n\n` +
    `We are reaching out about ${roleLabel} at ${venue}${cityPart}${windowPart}.${corridorPart}${dealPart} ` +
    `We can share our EPK, live set video, stage plot, and recent regional draw numbers right away—please let us know what dates are open for a hold.` +
    angle
  );
}

export function computeSignalScore(input: SignalScoringInput): number {
  if (typeof input.fitScore === "number" && Number.isFinite(input.fitScore)) {
    return clampFitScore(input.fitScore);
  }

  let score = 45;
  const type = input.signalType.trim().toLowerCase();
  if (HIGH_VALUE_BAND_TYPES.has(type)) score += 26;
  else if (BAND_LEAD_TYPES.has(type)) score += 20;
  else if (MUSIC_INTEL_TYPES.has(type)) score += 10;
  else if (LOW_SIGNAL_TYPES.has(type)) score -= 25;

  const urgency = normalizeUrgency(input.urgency);
  if (urgency === "urgent") score += 20;
  else if (urgency === "high") score += 12;
  else if (urgency === "low") score -= 10;

  if (input.corridor && input.corridor.trim().length > 0) score += 6;
  if (input.billRole === "support" || input.billRole === "festival" || input.billRole === "headliner") {
    score += 6;
  } else if (input.billRole === "co_bill" || input.billRole === "session") {
    score += 4;
  }
  if (input.targetWindow && input.targetWindow.trim().length > 0) score += 4;

  if (input.sourceUrl && input.sourceUrl.trim().length > 0) score += 10;
  if (input.summary && input.summary.trim().length >= 24) score += 5;
  if (input.recommendedAction && input.recommendedAction.trim().length > 0) score += 5;

  const payload = input.payload && typeof input.payload === "object" ? input.payload : null;
  if (payload) {
    const richMatches = Object.keys(payload).filter((key) => RICH_BAND_PAYLOAD_KEYS.has(key)).length;
    if (richMatches >= 3) score += 12;
    else if (richMatches >= 2) score += 9;
    else if (richMatches === 1) score += 5;
  }

  return clampFitScore(score);
}

export function normalizeSignalScoring(input: SignalScoringInput): NormalizedSignalScoring {
  const urgency = normalizeUrgency(input.urgency);
  const fitScore = computeSignalScore(input);
  const priorityTier =
    input.priorityTier === "high" ||
    input.priorityTier === "medium" ||
    input.priorityTier === "low"
      ? input.priorityTier
      : derivePriorityTier(fitScore, urgency);
  const recommendedAction =
    input.recommendedAction?.trim() || defaultBandRecommendedAction(input);
  return { fitScore, priorityTier, urgency, recommendedAction };
}

export interface SortableSignal {
  status: string;
  fitScore: number;
  priorityTier: SignalPriorityTier;
  receivedAt: string;
}

export function filterAndSortSignals<T extends SortableSignal>(
  signals: readonly T[],
  options: {
    statusFilter: string;
    priorityFilter: "all" | SignalPriorityTier;
    sortMode: SignalSortMode;
  },
): T[] {
  const filtered = signals.filter((signal) => {
    if (options.statusFilter !== "all" && signal.status !== options.statusFilter) return false;
    if (options.priorityFilter !== "all" && signal.priorityTier !== options.priorityFilter) {
      return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (options.sortMode === "score") {
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
    }
    return Date.parse(b.receivedAt) - Date.parse(a.receivedAt);
  });
}
