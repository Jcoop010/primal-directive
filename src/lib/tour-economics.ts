export type TourStopEconomics = {
  id: string;
  label: string;
  date?: string;
  expectedGuarantee: number;
  expectedDoor: number;
  expectedMerch: number;
  travelCost: number;
  lodgingCost: number;
  crewCost: number;
  productionCost: number;
  otherCosts: number;
  confidence: number;
};

export type TourStopSummary = {
  id: string;
  label: string;
  expectedGross: number;
  expectedCosts: number;
  expectedNet: number;
  confidence: number;
  riskAdjustedNet: number;
  breakEvenGross: number;
  minimumGuaranteeForTarget: (targetNet: number) => number;
};

export type TourSummary = {
  stopCount: number;
  expectedGross: number;
  expectedCosts: number;
  expectedNet: number;
  riskAdjustedNet: number;
  expectedMargin: number | null;
  stops: TourStopSummary[];
};

const COST_FIELDS = [
  "travelCost",
  "lodgingCost",
  "crewCost",
  "productionCost",
  "otherCosts",
] as const;

function assertNonNegativeFinite(value: number, field: string, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label}: ${field} must be finite and non-negative.`);
  }
}

export function summarizeTourStop(stop: TourStopEconomics): TourStopSummary {
  for (const field of ["expectedGuarantee", "expectedDoor", "expectedMerch", ...COST_FIELDS] as const) {
    assertNonNegativeFinite(stop[field], field, stop.label);
  }
  if (!Number.isFinite(stop.confidence) || stop.confidence < 0 || stop.confidence > 1) {
    throw new Error(`${stop.label}: confidence must be between 0 and 1.`);
  }
  if (!stop.id.trim() || !stop.label.trim()) {
    throw new Error("Each tour stop requires an ID and label.");
  }

  const expectedGross = stop.expectedGuarantee + stop.expectedDoor + stop.expectedMerch;
  const expectedCosts = COST_FIELDS.reduce((sum, field) => sum + stop[field], 0);
  const expectedNet = expectedGross - expectedCosts;

  return {
    id: stop.id,
    label: stop.label,
    expectedGross,
    expectedCosts,
    expectedNet,
    confidence: stop.confidence,
    riskAdjustedNet: expectedNet * stop.confidence,
    breakEvenGross: expectedCosts,
    minimumGuaranteeForTarget: (targetNet: number) => {
      if (!Number.isFinite(targetNet)) throw new Error("Target net must be finite.");
      return Math.max(0, targetNet + expectedCosts - stop.expectedDoor - stop.expectedMerch);
    },
  };
}

/**
 * Summarizes supplied estimates. This intentionally does not infer driving
 * distance, taxes, or confirmed income. Costs and revenue must come from
 * user input or a connected, attributed source.
 */
export function summarizeTour(stops: readonly TourStopEconomics[]): TourSummary {
  const ids = new Set<string>();
  const summaries = stops.map((stop) => {
    if (ids.has(stop.id)) throw new Error(`Duplicate tour stop ID: ${stop.id}`);
    ids.add(stop.id);
    return summarizeTourStop(stop);
  });

  const expectedGross = summaries.reduce((sum, stop) => sum + stop.expectedGross, 0);
  const expectedCosts = summaries.reduce((sum, stop) => sum + stop.expectedCosts, 0);
  const expectedNet = expectedGross - expectedCosts;

  return {
    stopCount: summaries.length,
    expectedGross,
    expectedCosts,
    expectedNet,
    riskAdjustedNet: summaries.reduce((sum, stop) => sum + stop.riskAdjustedNet, 0),
    expectedMargin: expectedGross > 0 ? expectedNet / expectedGross : null,
    stops: [...summaries].sort((a, b) => b.riskAdjustedNet - a.riskAdjustedNet),
  };
}
