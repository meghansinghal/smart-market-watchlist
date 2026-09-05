import { describe, expect, it } from "vitest";
import {
  applyGuardrails,
  assessDataStatus,
  attentionScore,
  baseClassification,
  buildReasons,
  computeChange,
  dailyReturnStdevPct,
  divergenceScore,
  movementScore,
  unusualnessScore,
  volumeScore,
} from "@/server/services/changeEngine";
import type { Checkpoint, MarketObservation } from "@/server/domain/types";

function observation(overrides: Partial<MarketObservation> = {}): MarketObservation {
  return {
    id: "obs-1",
    symbol: "TEST.NS",
    price: 100,
    volume: 1_000_000,
    observedAt: new Date("2026-09-04T09:00:00Z"),
    receivedAt: new Date("2026-09-04T09:00:00Z"),
    source: "SYNTHETIC",
    freshness: "LIVE",
    ...overrides,
  };
}

function checkpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    symbol: "TEST.NS",
    price: 100,
    volume: 1_000_000,
    observedAt: new Date("2026-09-03T09:00:00Z"),
    source: "SYNTHETIC",
    freshness: "LIVE",
    checkedAt: new Date("2026-09-03T09:00:00Z"),
    ...overrides,
  };
}

function flatHistory(days: number, price = 100): number[] {
  return Array.from({ length: days }, () => price);
}

describe("score primitives", () => {
  it("movementScore saturates at 8%", () => {
    expect(movementScore(0)).toBe(0);
    expect(movementScore(4)).toBeCloseTo(0.5);
    expect(movementScore(8)).toBe(1);
    expect(movementScore(20)).toBe(1);
  });

  it("dailyReturnStdevPct computes population stdev of returns", () => {
    const closes = [100, 101, 99, 100.5, 99.5];
    const stdev = dailyReturnStdevPct(closes);
    expect(stdev).not.toBeNull();
    expect(stdev!).toBeGreaterThan(0);
  });

  it("dailyReturnStdevPct returns null for insufficient data", () => {
    expect(dailyReturnStdevPct([100])).toBeNull();
    expect(dailyReturnStdevPct([])).toBeNull();
  });

  it("unusualnessScore is 0 without a stdev", () => {
    expect(unusualnessScore(5, null)).toBe(0);
  });

  it("unusualnessScore rises with z-score", () => {
    expect(unusualnessScore(1, 1)).toBeCloseTo(0.25); // z=1 / saturation 4
    expect(unusualnessScore(8, 1)).toBe(1); // saturates
  });

  it("divergenceScore is 0 without a benchmark", () => {
    expect(divergenceScore(5, null)).toBe(0);
  });

  it("divergenceScore reflects the gap vs the benchmark", () => {
    expect(divergenceScore(5, 5)).toBe(0); // moved exactly with the benchmark
    expect(divergenceScore(6, 0)).toBe(1); // 6pp gap saturates
  });

  it("volumeScore handles missing volume without fabricating a score", () => {
    expect(volumeScore(null, 1_000_000)).toBe(0);
    expect(volumeScore(1_000_000, null)).toBe(0);
    expect(volumeScore(1_000_000, 0)).toBe(0);
  });

  it("volumeScore rises with the ratio to average volume", () => {
    expect(volumeScore(1_000_000, 1_000_000)).toBe(0); // ratio 1 = normal
    expect(volumeScore(3_000_000, 1_000_000)).toBe(1); // ratio 3 saturates
  });

  it("attentionScore is the documented weighted sum", () => {
    const score = attentionScore({
      movementScore: 1,
      unusualnessScore: 1,
      divergenceScore: 1,
      volumeScore: 1,
    });
    expect(score).toBeCloseTo(1);
    const partial = attentionScore({
      movementScore: 1,
      unusualnessScore: 0,
      divergenceScore: 0,
      volumeScore: 0,
    });
    expect(partial).toBeCloseTo(0.35);
  });

  it("baseClassification follows the documented thresholds", () => {
    expect(baseClassification(0)).toBe("NORMAL");
    expect(baseClassification(0.29)).toBe("NORMAL");
    expect(baseClassification(0.3)).toBe("NOTABLE");
    expect(baseClassification(0.54)).toBe("NOTABLE");
    expect(baseClassification(0.55)).toBe("SIGNIFICANT");
  });
});

describe("guardrails", () => {
  it("large absolute movement forces SIGNIFICANT when not sector-aligned", () => {
    const { classification } = applyGuardrails({
      attentionScoreValue: 0.1, // otherwise NORMAL
      pctChangePoints: 6,
      scores: { movementScore: 0.75, unusualnessScore: 0, divergenceScore: 0.8, volumeScore: 0, attentionScore: 0.1 },
      hasBenchmark: true,
    });
    expect(classification).toBe("SIGNIFICANT");
  });

  it("large sector-aligned movement is capped at NOTABLE, not auto-SIGNIFICANT", () => {
    const { classification, sectorAligned } = applyGuardrails({
      attentionScoreValue: 0.1,
      pctChangePoints: 7,
      scores: { movementScore: 0.85, unusualnessScore: 0, divergenceScore: 0.05, volumeScore: 0, attentionScore: 0.1 },
      hasBenchmark: true,
    });
    expect(sectorAligned).toBe(true);
    expect(classification).toBe("NOTABLE");
  });

  it("tiny price movement cannot become SIGNIFICANT purely from volume", () => {
    const { classification } = applyGuardrails({
      attentionScoreValue: 0.6, // volume/unusualness pushed weighted score into SIGNIFICANT
      pctChangePoints: 0.1,
      scores: { movementScore: 0.01, unusualnessScore: 0.9, divergenceScore: 0, volumeScore: 1, attentionScore: 0.6 },
      hasBenchmark: true,
    });
    expect(classification).toBe("NOTABLE");
  });

  it("high volume with limited price movement can float up to NOTABLE", () => {
    const { classification } = applyGuardrails({
      attentionScoreValue: 0.15, // below NOTABLE threshold on its own
      pctChangePoints: 0.8,
      scores: { movementScore: 0.1, unusualnessScore: 0, divergenceScore: 0, volumeScore: 0.7, attentionScore: 0.15 },
      hasBenchmark: true,
    });
    expect(classification).toBe("NOTABLE");
  });

  it("low volume/movement stays NORMAL", () => {
    const { classification } = applyGuardrails({
      attentionScoreValue: 0.05,
      pctChangePoints: 0.3,
      scores: { movementScore: 0.05, unusualnessScore: 0, divergenceScore: 0, volumeScore: 0.1, attentionScore: 0.05 },
      hasBenchmark: true,
    });
    expect(classification).toBe("NORMAL");
  });
});

describe("buildReasons", () => {
  it("flags HISTORICAL_CONTEXT_UNAVAILABLE when history or benchmark is thin", () => {
    const reasons = buildReasons({
      pctChangePoints: 1,
      scores: { movementScore: 0.1, unusualnessScore: 0, divergenceScore: 0, volumeScore: 0, attentionScore: 0.05 },
      sectorAligned: false,
      hasBenchmark: false,
      historicalDaysUsed: 2,
    });
    expect(reasons).toContain("HISTORICAL_CONTEXT_UNAVAILABLE");
  });

  it("does not fabricate SECTOR_DIVERGENCE when the move is sector-aligned", () => {
    const reasons = buildReasons({
      pctChangePoints: 6,
      scores: { movementScore: 0.7, unusualnessScore: 0, divergenceScore: 0.1, volumeScore: 0, attentionScore: 0.3 },
      sectorAligned: true,
      hasBenchmark: true,
      historicalDaysUsed: 20,
    });
    expect(reasons).toContain("SECTOR_ALIGNED_MOVE");
    expect(reasons).not.toContain("SECTOR_DIVERGENCE");
    expect(reasons).not.toContain("LARGE_PRICE_MOVE");
  });
});

describe("assessDataStatus", () => {
  const now = new Date("2026-09-04T10:00:00Z");

  it("is OK for a fresh LIVE observation", () => {
    expect(assessDataStatus({ freshness: "LIVE", observedAt: now }, now)).toBe("OK");
  });

  it("is LIMITED for STALE, STATIC, or UNAVAILABLE freshness", () => {
    expect(assessDataStatus({ freshness: "STALE", observedAt: now }, now)).toBe("LIMITED");
    expect(assessDataStatus({ freshness: "STATIC", observedAt: now }, now)).toBe("LIMITED");
    expect(assessDataStatus({ freshness: "UNAVAILABLE", observedAt: now }, now)).toBe("LIMITED");
  });

  it("is LIMITED once a CACHED observation is more than 24h old", () => {
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    expect(assessDataStatus({ freshness: "CACHED", observedAt: twoDaysAgo }, now)).toBe("LIMITED");
  });

  it("is OK for a fresh CACHED observation", () => {
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(assessDataStatus({ freshness: "CACHED", observedAt: fiveMinAgo }, now)).toBe("OK");
  });

  it("is OK for CLOSED (last-close) data — the age backstop only applies to CACHED", () => {
    // A Friday close observation, still correctly labeled CLOSED for a
    // Monday-morning visit, must not read as "limited" just because it's
    // well over 24h old — that's expected over a weekend.
    const fridayClose = new Date(now.getTime() - 60 * 60 * 60 * 1000); // 60h old
    expect(assessDataStatus({ freshness: "CLOSED", observedAt: fridayClose }, now)).toBe("OK");
  });

  it("is OK for DELAYED regardless of raw age — freshness already accounts for market state", () => {
    const oldDelayed = new Date(now.getTime() - 30 * 60 * 60 * 1000);
    expect(assessDataStatus({ freshness: "DELAYED", observedAt: oldDelayed }, now)).toBe("OK");
  });
});

describe("computeChange (integration of the pure pieces)", () => {
  it("returns NEW status with no misleading change for a first observation", () => {
    const result = computeChange({
      symbol: "TEST.NS",
      current: observation(),
      checkpoint: null,
      historicalCloses: flatHistory(20),
      averageHistoricalVolume: 1_000_000,
      benchmarkPctChangePoints: 0,
      benchmarkSymbol: "^NSEI",
    });
    expect(result.dataStatus).toBe("NEW");
    expect(result.classification).toBeNull();
    expect(result.reasons).toEqual(["FIRST_OBSERVATION"]);
    expect(result.pctChangeSinceCheckpoint).toBeNull();
  });

  it("does not score stale/unavailable observations normally", () => {
    const result = computeChange({
      symbol: "TEST.NS",
      current: observation({ freshness: "STALE" }),
      checkpoint: checkpoint(),
      historicalCloses: flatHistory(20),
      averageHistoricalVolume: 1_000_000,
      benchmarkPctChangePoints: 0,
      benchmarkSymbol: "^NSEI",
    });
    expect(result.dataStatus).toBe("LIMITED");
    expect(result.classification).toBeNull();
    expect(result.scores).toBeNull();
    expect(result.reasons).toEqual(["STALE_DATA"]);
  });

  it("classifies a large idiosyncratic move as SIGNIFICANT with clear reasons", () => {
    const result = computeChange({
      symbol: "TEST.NS",
      current: observation({ price: 108, volume: 1_200_000 }), // +8%
      checkpoint: checkpoint({ price: 100 }),
      historicalCloses: [100, 100.2, 99.8, 100.1, 99.9, 100.3, 99.7, 100, 100.1, 99.9, 100, 100.2, 99.8, 100.1, 99.9, 100.3, 99.7, 100, 100.1, 99.9],
      averageHistoricalVolume: 1_000_000,
      benchmarkPctChangePoints: 0.5, // benchmark barely moved -> not sector-aligned
      benchmarkSymbol: "^NSEI",
    });
    expect(result.dataStatus).toBe("OK");
    expect(result.classification).toBe("SIGNIFICANT");
    expect(result.reasons).toContain("LARGE_PRICE_MOVE");
  });

  it("caps a large sector-wide move at NOTABLE and explains why", () => {
    const closes = flatHistory(20);
    const result = computeChange({
      symbol: "TEST.NS",
      current: observation({ price: 106 }), // +6%
      checkpoint: checkpoint({ price: 100 }),
      historicalCloses: closes,
      averageHistoricalVolume: 1_000_000,
      benchmarkPctChangePoints: 5.8, // benchmark moved almost identically
      benchmarkSymbol: "^NSEI",
    });
    expect(result.classification).toBe("NOTABLE");
    expect(result.reasons).toContain("SECTOR_ALIGNED_MOVE");
  });

  it("does not fabricate significance from a tiny move plus a volume spike", () => {
    const closes = flatHistory(20);
    const result = computeChange({
      symbol: "TEST.NS",
      current: observation({ price: 100.1, volume: 5_000_000 }), // +0.1%, 5x volume
      checkpoint: checkpoint({ price: 100 }),
      historicalCloses: closes,
      averageHistoricalVolume: 1_000_000,
      benchmarkPctChangePoints: 0,
      benchmarkSymbol: "^NSEI",
    });
    expect(result.classification).not.toBe("SIGNIFICANT");
    expect(result.reasons).toContain("LIMITED_PRICE_MOVEMENT");
  });

  it("flags insufficient historical data instead of fabricating unusualness", () => {
    const result = computeChange({
      symbol: "TEST.NS",
      current: observation({ price: 101 }),
      checkpoint: checkpoint({ price: 100 }),
      historicalCloses: [100, 100.5], // well below MIN_HISTORICAL_DAYS
      averageHistoricalVolume: null,
      benchmarkPctChangePoints: null,
      benchmarkSymbol: "^NSEI",
    });
    expect(result.scores?.unusualnessScore).toBe(0);
    expect(result.reasons).toContain("HISTORICAL_CONTEXT_UNAVAILABLE");
  });

  it("produces a normal, unremarkable classification with no reasons for a quiet day", () => {
    const result = computeChange({
      symbol: "TEST.NS",
      current: observation({ price: 100.2, volume: 1_000_000 }),
      checkpoint: checkpoint({ price: 100 }),
      historicalCloses: flatHistory(20),
      averageHistoricalVolume: 1_000_000,
      benchmarkPctChangePoints: 0.1,
      benchmarkSymbol: "^NSEI",
    });
    expect(result.classification).toBe("NORMAL");
  });
});
