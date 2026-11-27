export const SIGNAL_PRIORITIES = ["high", "medium", "low"] as const;
export type SignalPriorityTier = (typeof SIGNAL_PRIORITIES)[number];

export const SIGNAL_URGENCIES = ["urgent", "high", "normal", "low"] as const;
export type SignalUrgency = (typeof SIGNAL_URGENCIES)[number];

export const SIGNAL_SORTS = ["score", "newest"] as const;
export type SignalSortMode = (typeof SIGNAL_SORTS)[number];

export interface SignalScoringInput {
  signalType: string;
  summary?: string | null;
  sourceUrl?: string | null;
  payload?: Record<string, unknown> | null;
  fitScore?: number | null;
  priorityTier?: SignalPriorityTier | null;
  urgency?: SignalUrgency | null;
  recommendedAction?: string | null;
}

export interface NormalizedSignalScoring {
  fitScore: number;
  priorityTier: SignalPriorityTier;
  urgency: SignalUrgency;
  recommendedAction: string | null;
}

const HIGH_VALUE_TYPES = new Set([
  "booking_offer",
  "contract",
  "settlement",
  "urgent_reply",
  "venue_reply",
]);

const LEAD_TYPES = new Set([
  "venue_lead",
  "booking_lead",
  "festival_open",
  "tour_routing",
  "support_slot",
]);

const INTEL_TYPES = new Set(["market_intel", "press_lead", "playlist_lead", "handoff", "alert"]);

const LOW_SIGNAL_TYPES = new Set(["smoke_test", "heartbeat", "ping", "noise"]);

const RICH_PAYLOAD_KEYS = new Set([
  "city",
  "capacity",
  "email",
  "bookingEmail",
  "contact",
  "guarantee",
  "deadline",
  "date",
  "venue",
  "fee",
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

export function computeSignalScore(input: SignalScoringInput): number {
  if (typeof input.fitScore === "number" && Number.isFinite(input.fitScore)) {
    return clampFitScore(input.fitScore);
  }

  let score = 45;
  const type = input.signalType.trim().toLowerCase();
  if (HIGH_VALUE_TYPES.has(type)) score += 25;
  else if (LEAD_TYPES.has(type)) score += 18;
  else if (INTEL_TYPES.has(type)) score += 10;
  else if (LOW_SIGNAL_TYPES.has(type)) score -= 25;

  const urgency = normalizeUrgency(input.urgency);
  if (urgency === "urgent") score += 20;
  else if (urgency === "high") score += 12;
  else if (urgency === "low") score -= 10;

  if (input.sourceUrl && input.sourceUrl.trim().length > 0) score += 10;
  if (input.summary && input.summary.trim().length >= 24) score += 5;
  if (input.recommendedAction && input.recommendedAction.trim().length > 0) score += 5;

  const payload = input.payload && typeof input.payload === "object" ? input.payload : null;
  if (payload) {
    const richMatches = Object.keys(payload).filter((key) => RICH_PAYLOAD_KEYS.has(key)).length;
    if (richMatches >= 2) score += 10;
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
  const recommendedAction = input.recommendedAction?.trim() || null;
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
