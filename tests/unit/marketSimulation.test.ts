import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Checkpoint, ObservationSource, RawObservation } from "@/server/domain/types";
import { SyntheticMarketDataProvider } from "@/server/providers/syntheticProvider";
import {
  applyGuardrails,
  assessDataStatus,
  attentionScore,
  computeChange,
  dailyReturnStdevPct,
  divergenceScore,
  movementScore,
  unusualnessScore,
  volumeScore,
} from "@/server/services/changeEngine";

// Only the resilience/independence describe block below needs these
// mocked — the pipeline-integrity tests use the real
// SyntheticMarketDataProvider and real changeEngine functions directly,
// neither of which touches any repository, so these mocks are inert for
// them. Declared at module top level (not nested in a describe) so
// Vitest's vi.mock hoisting — which relocates the calls to the very top
// of the file — can still see the variables it closes over.
const observationRepositoryMock = { latestFor: vi.fn(), saveIfNewer: vi.fn(), save: vi.fn(), getById: vi.fn() };
const historicalRepositoryMock = { getRecent: vi.fn(), upsertMany: vi.fn() };
const demoScenarioRepositoryMock = { get: vi.fn(), getMany: vi.fn(), set: vi.fn(), resetAll: vi.fn() };

vi.mock("@/server/repositories/observationRepository", () => ({
  observationRepository: observationRepositoryMock,
}));
vi.mock("@/server/repositories/historicalRepository", () => ({
  historicalRepository: historicalRepositoryMock,
}));
vi.mock("@/server/repositories/demoScenarioRepository", () => ({
  demoScenarioRepository: demoScenarioRepositoryMock,
}));

const provider = new SyntheticMarketDataProvider();

function checkpointFrom(obs: RawObservation): Checkpoint {
  return {
    symbol: obs.symbol,
    price: obs.price,
    volume: obs.volume,
    observedAt: obs.observedAt,
    source: obs.source,
    freshness: "CLOSED",
    checkedAt: obs.observedAt,
  };
}

describe("Market Simulation → Meaningful Change Engine pipeline integrity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A fixed instant so every seeded-random scenario draw is reproducible.
    vi.setSystemTime(new Date("2026-09-04T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["PRICE_SHOCK", "VOLUME_SPIKE", "SECTOR_DIVERGENCE"] as const)(
    "classifies a simulated %s purely from the resulting observation — never from the scenario label",
    async (scenario) => {
      const symbol = "INFY.NS";
      const baseline = await provider.getObservation(symbol, "NORMAL_MARKET");
      const simulated = await provider.getObservation(symbol, scenario);
      const historicalBars = await provider.getHistorical(symbol, 20);
      const historicalCloses = historicalBars.map((b) => b.close);
      const averageHistoricalVolume =
        historicalBars.reduce((sum, b) => sum + (b.volume ?? 0), 0) / historicalBars.length;
      const benchmarkPctChangePoints = 0; // no sector move — isolates the stock's own simulated move

      // The engine's own conclusion, going through the exact same pipeline
      // a real observation would (persistence is a separate concern —
      // this is the pure scoring core, computeChange, which has no
      // "scenario" concept in its input type at all).
      const result = computeChange({
        symbol,
        current: {
          id: "sim-obs",
          ...simulated,
          receivedAt: simulated.observedAt,
          freshness: "CLOSED",
        },
        checkpoint: checkpointFrom(baseline),
        historicalCloses,
        averageHistoricalVolume,
        benchmarkPctChangePoints,
        benchmarkSymbol: "^CNXIT",
      });

      // Independently recomputed from the raw numbers alone — this
      // expectation is built without ever referencing which scenario
      // produced `simulated`, so if computeChange agrees with it, the
      // classification can only have come from the numbers.
      const pctChangePoints = ((simulated.price - baseline.price) / baseline.price) * 100;
      const stdev = dailyReturnStdevPct(historicalCloses);
      const scores = {
        movementScore: movementScore(pctChangePoints),
        unusualnessScore: unusualnessScore(pctChangePoints, stdev),
        divergenceScore: divergenceScore(pctChangePoints, benchmarkPctChangePoints),
        volumeScore: volumeScore(simulated.volume, averageHistoricalVolume),
        attentionScore: 0,
      };
      scores.attentionScore = attentionScore(scores);
      const { classification: expectedClassification } = applyGuardrails({
        attentionScoreValue: scores.attentionScore,
        pctChangePoints,
        scores,
        hasBenchmark: true,
      });

      expect(result.classification).toBe(expectedClassification);
      expect(result.dataStatus).toBe("OK");
    },
  );

  it("STALE_DATA is classified LIMITED via the same freshness/age rule real stale data would hit", async () => {
    const { classifyFreshness } = await import("@/server/services/marketDataService");
    const now = new Date();
    const stale = await provider.getObservation("INFY.NS", "STALE_DATA");

    const freshness = classifyFreshness(stale.observedAt, now, "SYNTHETIC");
    expect(freshness).toBe("STALE");

    const status = assessDataStatus({ freshness, observedAt: stale.observedAt }, now);
    expect(status).toBe("LIMITED");
  });

  it("PROVIDER_FAILURE throws the same MarketDataError shape a real provider outage would", async () => {
    const { MarketDataError } = await import("@/server/providers/types");
    await expect(provider.getObservation("INFY.NS", "PROVIDER_FAILURE")).rejects.toBeInstanceOf(
      MarketDataError,
    );
  });
});

describe("Market Simulation resilience — falls back exactly like a real provider outage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historicalRepositoryMock.getRecent.mockResolvedValue([]);
  });

  it("a symbol simulating PROVIDER_FAILURE falls back to the latest cached observation, labeled CACHED", async () => {
    const { marketDataService } = await import("@/server/services/marketDataService");

    demoScenarioRepositoryMock.get.mockResolvedValue({ scenario: "PROVIDER_FAILURE", updatedAt: new Date() });
    observationRepositoryMock.latestFor.mockResolvedValueOnce({
      id: "obs-cached",
      symbol: "INFY.NS",
      price: 1500,
      volume: 8_000_000,
      observedAt: new Date(),
      receivedAt: new Date(),
      source: "SYNTHETIC" as ObservationSource,
      freshness: "CLOSED",
    });

    const result = await marketDataService.fetchObservation("INFY.NS");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.freshness).toBe("CACHED");
      expect(result.observation.price).toBe(1500);
    }
  });

  it("a symbol simulating PROVIDER_FAILURE with no cache falls back to the static snapshot", async () => {
    const { marketDataService } = await import("@/server/services/marketDataService");

    demoScenarioRepositoryMock.get.mockResolvedValue({ scenario: "PROVIDER_FAILURE", updatedAt: new Date() });
    observationRepositoryMock.latestFor.mockResolvedValueOnce(null);
    observationRepositoryMock.saveIfNewer.mockImplementationOnce(async (raw, freshness) => ({
      id: "obs-static",
      ...raw,
      receivedAt: new Date(),
      freshness,
    }));

    const result = await marketDataService.fetchObservation("INFY.NS");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.observation.freshness).toBe("STATIC");
  });

  it("setting or resetting a simulated scenario has no dependency on any user or watchlist", async () => {
    const { demoService } = await import("@/server/services/demoService");

    await demoService.setScenario("NOT-ON-ANY-WATCHLIST.NS", "PRICE_SHOCK");
    expect(demoScenarioRepositoryMock.set).toHaveBeenCalledWith("NOT-ON-ANY-WATCHLIST.NS", "PRICE_SHOCK");

    await demoService.reset();
    expect(demoScenarioRepositoryMock.resetAll).toHaveBeenCalledOnce();
  });
});
