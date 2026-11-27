export const SIGNAL_PRIORITIES = ["high", "medium", "low"] as const;
export type SignalPriorityTier = (typeof SIGNAL_PRIORITIES)[number];

export const SIGNAL_URGENCIES = ["urgent", "high", "normal", "low"] as const;
export type SignalUrgency = (typeof SIGNAL_URGENCIES)[number];

export const SIGNAL_SORTS = ["score", "newest", "gap"] as const;
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

export interface PreShowYieldInput {
  guaranteeOrSplitEst: number;
  estAttendance: number;
  merchPerHeadEst: number;
  roadAndRoomCostEst: number;
}

export interface PreShowYieldEstimate {
  payoutEst: number;
  estAttendance: number;
  merchPerHeadEst: number;
  merchGrossEst: number;
  totalGrossEst: number;
  roadAndRoomCostEst: number;
  netYieldEst: number;
  breakEvenAttendance: number | null;
  breakEvenMerchPerHead: number | null;
}

export function computePreShowYield(input: PreShowYieldInput): PreShowYieldEstimate {
  const payoutEst = Math.max(0, Number.isFinite(input.guaranteeOrSplitEst) ? input.guaranteeOrSplitEst : 0);
  const estAttendance = Math.max(0, Math.round(Number.isFinite(input.estAttendance) ? input.estAttendance : 0));
  const merchPerHeadEst = Math.max(0, Number.isFinite(input.merchPerHeadEst) ? input.merchPerHeadEst : 0);
  const roadAndRoomCostEst = Math.max(
    0,
    Number.isFinite(input.roadAndRoomCostEst) ? input.roadAndRoomCostEst : 0,
  );
  const merchGrossEst = Math.round(estAttendance * merchPerHeadEst * 100) / 100;
  const totalGrossEst = Math.round((payoutEst + merchGrossEst) * 100) / 100;
  const netYieldEst = Math.round((totalGrossEst - roadAndRoomCostEst) * 100) / 100;
  const shortfall = Math.max(0, roadAndRoomCostEst - payoutEst);
  const breakEvenAttendance =
    shortfall === 0 ? 0 : merchPerHeadEst > 0 ? Math.ceil(shortfall / merchPerHeadEst) : null;
  const breakEvenMerchPerHead =
    shortfall === 0
      ? 0
      : estAttendance > 0
        ? Math.round((shortfall / estAttendance) * 100) / 100
        : null;

  return {
    payoutEst,
    estAttendance,
    merchPerHeadEst,
    merchGrossEst,
    totalGrossEst,
    roadAndRoomCostEst,
    netYieldEst,
    breakEvenAttendance,
    breakEvenMerchPerHead,
  };
}

export interface RoutingAnchorWindow {
  prevCity?: string;
  prevDate?: string;
  nextCity?: string;
  nextDate?: string;
}

export interface RoutingGapAssessment {
  gapFitScore: number | null;
  gapLabel: "Strong gap fit" | "Possible bridge" | "Off-corridor" | null;
  gapReason: string | null;
}

const REGION_ALIASES: Record<string, readonly string[]> = {
  tn: ["tn", "tennessee", "nashville", "knoxville", "chattanooga", "memphis", "i-40", "i-75", "i-65", "southeast"],
  nc: ["nc", "north carolina", "asheville", "raleigh", "carrboro", "chapel hill", "charlotte", "sanford", "carolinas", "piedmont", "i-40", "i-85", "southeast"],
  ga: ["ga", "georgia", "atlanta", "athens", "savannah", "i-75", "southeast"],
  sc: ["sc", "south carolina", "charleston", "greenville", "carolinas", "southeast"],
  ky: ["ky", "kentucky", "louisville", "lexington", "i-65", "i-71", "ohio river", "midwest"],
  in: ["in", "indiana", "indianapolis", "indy", "i-65", "i-70", "midwest"],
  il: ["il", "illinois", "chicago", "great lakes", "midwest"],
  oh: ["oh", "ohio", "cincinnati", "columbus", "cleveland", "i-71", "ohio river", "midwest"],
  wi: ["wi", "wisconsin", "appleton", "milwaukee", "madison", "upper midwest", "midwest"],
};

export interface TouringCorridorPreset {
  id: string;
  label: string;
  region: "Southeast" | "Midwest";
  prevCity: string;
  prevDate: string;
  nextCity: string;
  nextDate: string;
}

export const TOURING_CORRIDOR_PRESETS: readonly TouringCorridorPreset[] = [
  {
    id: "se-i40-nash-avl",
    label: "I-40 · Nashville → Asheville",
    region: "Southeast",
    prevCity: "Nashville, TN",
    prevDate: "2027-04-02",
    nextCity: "Asheville, NC",
    nextDate: "2027-04-05",
  },
  {
    id: "se-i75-nash-atl",
    label: "I-75 · Nashville → Atlanta",
    region: "Southeast",
    prevCity: "Nashville, TN",
    prevDate: "2027-04-16",
    nextCity: "Atlanta, GA",
    nextDate: "2027-04-19",
  },
  {
    id: "mw-i65-nash-chi",
    label: "I-65 · Nashville → Chicago",
    region: "Midwest",
    prevCity: "Nashville, TN",
    prevDate: "2027-05-07",
    nextCity: "Chicago, IL",
    nextDate: "2027-05-11",
  },
  {
    id: "mw-loop-lou-app",
    label: "Midwest · Louisville → Appleton",
    region: "Midwest",
    prevCity: "Louisville, KY",
    prevDate: "2027-08-05",
    nextCity: "Appleton, WI",
    nextDate: "2027-08-09",
  },
] as const;

export interface SignalsFilterState<TStatus extends string = string> {
  statusFilter: "all" | TStatus;
  priorityFilter: "all" | SignalPriorityTier;
  sortMode: SignalSortMode;
  prevCity: string;
  prevDate: string;
  nextCity: string;
  nextDate: string;
  activePresetId: string | null;
}

export function createDefaultSignalsFilterState<TStatus extends string = string>(): SignalsFilterState<TStatus> {
  return {
    statusFilter: "all",
    priorityFilter: "all",
    sortMode: "score",
    prevCity: "",
    prevDate: "",
    nextCity: "",
    nextDate: "",
    activePresetId: null,
  };
}

export function applyCorridorPreset<TStatus extends string = string>(
  preset: TouringCorridorPreset,
): SignalsFilterState<TStatus> {
  return {
    statusFilter: "all",
    priorityFilter: "all",
    sortMode: "gap",
    prevCity: preset.prevCity,
    prevDate: preset.prevDate,
    nextCity: preset.nextCity,
    nextDate: preset.nextDate,
    activePresetId: preset.id,
  };
}

export function clearAnchorsFromFilterState<TStatus extends string = string>(
  state: SignalsFilterState<TStatus>,
): SignalsFilterState<TStatus> {
  return {
    ...state,
    prevCity: "",
    prevDate: "",
    nextCity: "",
    nextDate: "",
    activePresetId: null,
    sortMode: state.sortMode === "gap" ? "score" : state.sortMode,
  };
}

function tokenizeCity(value?: string): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function seasonForMonth(monthIndex: number): string {
  if (monthIndex >= 2 && monthIndex <= 4) return "spring";
  if (monthIndex >= 5 && monthIndex <= 7) return "summer";
  if (monthIndex >= 8 && monthIndex <= 10) return "fall";
  return "winter";
}

export function computeRoutingGapFit(
  signal: {
    title: string;
    summary?: string | null;
    corridor?: string | null;
    targetWindow?: string | null;
    payloadJson?: string | null;
  },
  anchors?: RoutingAnchorWindow | null,
): RoutingGapAssessment {
  const prevCity = anchors?.prevCity?.trim() ?? "";
  const nextCity = anchors?.nextCity?.trim() ?? "";
  const prevDate = anchors?.prevDate?.trim() ?? "";
  const nextDate = anchors?.nextDate?.trim() ?? "";

  if (!prevCity && !nextCity && !prevDate && !nextDate) {
    return { gapFitScore: null, gapLabel: null, gapReason: null };
  }

  const haystack = [
    signal.corridor ?? "",
    signal.title,
    signal.summary ?? "",
    signal.targetWindow ?? "",
    signal.payloadJson ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let score = 20;
  const reasons: string[] = [];

  // 1. Corridor / city proximity scoring (up to +50)
  const anchorTokens = [...tokenizeCity(prevCity), ...tokenizeCity(nextCity)];
  if (anchorTokens.length > 0) {
    const directHits = anchorTokens.filter((token) => haystack.includes(token));
    if (directHits.length >= 2) {
      score += 50;
      reasons.push(`Direct corridor match (${directHits.slice(0, 2).join(" / ")})`);
    } else if (directHits.length === 1) {
      score += 38;
      reasons.push(`Matches anchor market (${directHits[0]})`);
    } else {
      const regionMatched = Object.values(REGION_ALIASES).some(
        (aliases) =>
          anchorTokens.some((token) => aliases.includes(token)) &&
          aliases.some((alias) => haystack.includes(alias)),
      );
      if (regionMatched) {
        score += 28;
        reasons.push("Same regional touring corridor");
      } else {
        reasons.push("Different market corridor");
      }
    }
  } else if (signal.corridor) {
    score += 20;
    reasons.push(`Corridor: ${signal.corridor}`);
  }

  // 2. Date / target window alignment (up to +30)
  const startMs = prevDate ? Date.parse(prevDate) : Number.NaN;
  const endMs = nextDate ? Date.parse(nextDate) : Number.NaN;
  if (Number.isFinite(startMs) || Number.isFinite(endMs)) {
    const windowText = (signal.targetWindow ?? "").toLowerCase();
    const isoMatch = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(haystack);
    if (isoMatch) {
      const sigMs = Date.parse(isoMatch[1]);
      const lo = Number.isFinite(startMs) ? startMs : sigMs;
      const hi = Number.isFinite(endMs) ? endMs : sigMs;
      if (sigMs >= Math.min(lo, hi) && sigMs <= Math.max(lo, hi)) {
        score += 30;
        reasons.push(`Date ${isoMatch[1]} sits inside anchor gap`);
      } else {
        score -= 10;
        reasons.push(`Date ${isoMatch[1]} falls outside anchor window`);
      }
    } else if (windowText) {
      const refDate = new Date(Number.isFinite(startMs) ? startMs : endMs);
      const year = String(refDate.getUTCFullYear());
      const season = seasonForMonth(refDate.getUTCMonth());
      const quarter = `q${Math.floor(refDate.getUTCMonth() / 3) + 1}`;
      const rolling = /week|rolling|open|weekend/.test(windowText);
      if (windowText.includes(season) || windowText.includes(quarter) || windowText.includes(year)) {
        score += 25;
        reasons.push(`Window aligns (${signal.targetWindow})`);
      } else if (rolling) {
        score += 18;
        reasons.push(`Flexible booking window (${signal.targetWindow})`);
      } else {
        score += 8;
        reasons.push(`Check window (${signal.targetWindow})`);
      }
    } else {
      score += 12;
      reasons.push("Open date window");
    }
  }

  const gapFitScore = clampFitScore(score);
  const gapLabel =
    gapFitScore >= 70
      ? "Strong gap fit"
      : gapFitScore >= 45
        ? "Possible bridge"
        : "Off-corridor";
  return {
    gapFitScore,
    gapLabel,
    gapReason: reasons.join(" · ") || null,
  };
}

export interface SortableSignal {
  status: string;
  fitScore: number;
  priorityTier: SignalPriorityTier;
  receivedAt: string;
  gapFitScore?: number | null;
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
    if (options.sortMode === "gap") {
      const ga = a.gapFitScore ?? -1;
      const gb = b.gapFitScore ?? -1;
      if (gb !== ga) return gb - ga;
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
    } else if (options.sortMode === "score") {
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
    }
    return Date.parse(b.receivedAt) - Date.parse(a.receivedAt);
  });
}
