import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeTour, summarizeTourStop, type TourStopEconomics } from "./tour-economics.ts";

const stop = (overrides: Partial<TourStopEconomics> = {}): TourStopEconomics => ({
  id: "show-1",
  label: "Example venue",
  expectedGuarantee: 1000,
  expectedDoor: 200,
  expectedMerch: 100,
  travelCost: 120,
  lodgingCost: 100,
  crewCost: 80,
  productionCost: 30,
  otherCosts: 20,
  confidence: 0.8,
  ...overrides,
});

describe("tour economics", () => {
  it("calculates expected gross, costs, net, and risk-adjusted net", () => {
    const result = summarizeTourStop(stop());
    assert.equal(result.expectedGross, 1300);
    assert.equal(result.expectedCosts, 350);
    assert.equal(result.expectedNet, 950);
    assert.equal(result.riskAdjustedNet, 760);
    assert.equal(result.breakEvenGross, 350);
  });

  it("calculates the guarantee needed to reach a target net", () => {
    const result = summarizeTourStop(stop());
    assert.equal(result.minimumGuaranteeForTarget(1000), 1050);
  });

  it("aggregates a tour and ranks higher risk-adjusted stops first", () => {
    const result = summarizeTour([
      stop({ id: "low", label: "Lower return", expectedGuarantee: 300, confidence: 0.7 }),
      stop({ id: "high", label: "Higher return", expectedGuarantee: 1500, confidence: 0.9 }),
    ]);
    assert.equal(result.stopCount, 2);
    assert.equal(result.expectedGross, 2400);
    assert.equal(result.expectedCosts, 700);
    assert.equal(result.expectedNet, 1700);
    assert.equal(result.expectedMargin, 1700 / 2400);
    assert.equal(result.stops[0].id, "high");
  });

  it("marks margin unavailable when gross revenue is zero", () => {
    const result = summarizeTour([stop({
      expectedGuarantee: 0,
      expectedDoor: 0,
      expectedMerch: 0,
    })]);
    assert.equal(result.expectedMargin, null);
  });

  it("rejects invalid amounts, confidence, and duplicate stop IDs", () => {
    assert.throws(() => summarizeTourStop(stop({ travelCost: -1 })), /non-negative/i);
    assert.throws(() => summarizeTourStop(stop({ confidence: 1.2 })), /between 0 and 1/i);
    assert.throws(() => summarizeTour([stop(), stop()]), /duplicate tour stop ID/i);
  });
});
