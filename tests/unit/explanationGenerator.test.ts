import { describe, expect, it } from "vitest";
import { explain } from "@/server/services/explanationGenerator";
import type { ChangeResult, MarketObservation } from "@/server/domain/types";

function observation(): MarketObservation {
  return {
    id: "obs-1",
    symbol: "INFY.NS",
    price: 1600,
    volume: 9_000_000,
    observedAt: new Date(),
    receivedAt: new Date(),
    source: "SYNTHETIC",
    freshness: "LIVE",
  };
}

function baseResult(overrides: Partial<ChangeResult>): ChangeResult {
  return {
    symbol: "INFY.NS",
    dataStatus: "OK",
    classification: "NORMAL",
    scores: null,
    reasons: [],
    pctChangeSinceCheckpoint: 0,
    currentObservation: observation(),
    previousCheckpoint: null,
    benchmarkSymbol: "^CNXIT",
    historicalDaysUsed: 20,
    ...overrides,
  };
}

describe("explain", () => {
  it("produces a calm 'nothing changed' headline with no bullets for NORMAL/no reasons", () => {
    const explanation = explain(baseResult({ classification: "NORMAL", reasons: [] }));
    expect(explanation.headline).toMatch(/nothing meaningful changed/i);
    expect(explanation.bullets).toEqual([]);
  });

  it("is deterministic — same input always produces the same output", () => {
    const result = baseResult({ classification: "SIGNIFICANT", reasons: ["LARGE_PRICE_MOVE"], pctChangeSinceCheckpoint: 0.062 });
    expect(explain(result)).toEqual(explain(result));
  });

  it("explains a sector-aligned move without implying it's stock-specific", () => {
    const result = baseResult({
      classification: "NOTABLE",
      reasons: ["SECTOR_ALIGNED_MOVE"],
      pctChangeSinceCheckpoint: 0.055,
    });
    const explanation = explain(result);
    expect(explanation.bullets[0]).toMatch(/sector-wide/i);
  });

  it("flags a new addition without claiming a misleading change", () => {
    const result = baseResult({
      dataStatus: "NEW",
      classification: null,
      reasons: ["FIRST_OBSERVATION"],
      pctChangeSinceCheckpoint: null,
      previousCheckpoint: null,
    });
    const explanation = explain(result);
    expect(explanation.headline).toMatch(/now tracking/i);
  });

  it("surfaces stale data instead of presenting it as a normal change", () => {
    const result = baseResult({
      dataStatus: "LIMITED",
      classification: null,
      reasons: ["STALE_DATA"],
    });
    const explanation = explain(result);
    expect(explanation.headline).toMatch(/out of date/i);
  });
});
