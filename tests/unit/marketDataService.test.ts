import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const observationRepositoryMock = {
  latestFor: vi.fn(),
  saveIfNewer: vi.fn(),
  save: vi.fn(),
  getById: vi.fn(),
};
const historicalRepositoryMock = {
  getRecent: vi.fn(),
  upsertMany: vi.fn(),
};
const demoScenarioRepositoryMock = {
  get: vi.fn().mockResolvedValue({ scenario: "NORMAL_MARKET", updatedAt: null }),
};

const yahooGetObservation = vi.fn();
const syntheticGetObservation = vi.fn();
const yahooGetHistorical = vi.fn().mockResolvedValue([]);
const syntheticGetHistorical = vi.fn().mockResolvedValue([]);

vi.mock("@/server/repositories/observationRepository", () => ({
  observationRepository: observationRepositoryMock,
}));
vi.mock("@/server/repositories/historicalRepository", () => ({
  historicalRepository: historicalRepositoryMock,
}));
vi.mock("@/server/repositories/demoScenarioRepository", () => ({
  demoScenarioRepository: demoScenarioRepositoryMock,
}));
vi.mock("@/server/providers/yahooProvider", () => ({
  YahooMarketDataProvider: class {
    getObservation = yahooGetObservation;
    getHistorical = yahooGetHistorical;
  },
}));
vi.mock("@/server/providers/syntheticProvider", () => ({
  SyntheticMarketDataProvider: class {
    getObservation = syntheticGetObservation;
    getHistorical = syntheticGetHistorical;
  },
}));
vi.mock("@/lib/env", () => ({ env: { marketDataProvider: "yahoo", marketDataTimeoutMs: 1000 } }));

const { marketDataService, classifyFreshness } = await import("@/server/services/marketDataService");
const { MarketDataError } = await import("@/server/providers/types");

beforeEach(() => {
  vi.clearAllMocks();
  demoScenarioRepositoryMock.get.mockResolvedValue({ scenario: "NORMAL_MARKET", updatedAt: null });
  historicalRepositoryMock.getRecent.mockResolvedValue([]);
  // Pin "now" to a known in-market-hours instant (Friday, 11:30 IST) so
  // freshness classification — which depends on real market hours — is
  // deterministic regardless of when the suite actually runs.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-04T06:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("marketDataService.fetchObservation fallback chain", () => {
  it("returns a LIVE observation and persists it when the provider succeeds", async () => {
    yahooGetObservation.mockResolvedValueOnce({
      symbol: "INFY.NS",
      price: 1600,
      volume: 1_000_000,
      observedAt: new Date(),
      source: "YAHOO",
    });
    observationRepositoryMock.saveIfNewer.mockImplementationOnce(async (raw, freshness) => ({
      id: "obs-1",
      ...raw,
      receivedAt: new Date(),
      freshness,
    }));

    const result = await marketDataService.fetchObservation("INFY.NS");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.freshness).toBe("LIVE");
      expect(result.observation.source).toBe("YAHOO");
    }
    expect(observationRepositoryMock.saveIfNewer).toHaveBeenCalledOnce();
  });

  it("falls back to the latest cached observation when the provider fails, and labels it CACHED", async () => {
    yahooGetObservation.mockRejectedValueOnce(new MarketDataError("boom", "INFY.NS"));
    observationRepositoryMock.latestFor.mockResolvedValueOnce({
      id: "obs-old",
      symbol: "INFY.NS",
      price: 1590,
      volume: 900_000,
      observedAt: new Date(Date.now() - 60 * 60 * 1000),
      receivedAt: new Date(Date.now() - 60 * 60 * 1000),
      source: "YAHOO",
      freshness: "LIVE",
    });

    const result = await marketDataService.fetchObservation("INFY.NS");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.freshness).toBe("CACHED");
      expect(result.observation.price).toBe(1590);
    }
  });

  it("falls back to the static snapshot when the provider fails and there is no cache", async () => {
    yahooGetObservation.mockRejectedValueOnce(new MarketDataError("boom", "INFY.NS"));
    observationRepositoryMock.latestFor.mockResolvedValueOnce(null);
    observationRepositoryMock.saveIfNewer.mockImplementationOnce(async (raw, freshness) => ({
      id: "obs-static",
      ...raw,
      receivedAt: new Date(),
      freshness,
    }));

    const result = await marketDataService.fetchObservation("INFY.NS");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.freshness).toBe("STATIC");
      expect(result.observation.source).toBe("STATIC_SNAPSHOT");
    }
  });

  it("reports unavailable — never silently swallowed — when every rung fails", async () => {
    yahooGetObservation.mockRejectedValueOnce(new MarketDataError("boom", "UNKNOWN.NS"));
    observationRepositoryMock.latestFor.mockResolvedValueOnce(null);

    const result = await marketDataService.fetchObservation("UNKNOWN.NS");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unavailable");
      expect(result.message).toContain("UNKNOWN.NS");
    }
  });

  it("routes a symbol with an active demo scenario through the synthetic provider even in yahoo mode", async () => {
    demoScenarioRepositoryMock.get.mockResolvedValueOnce({ scenario: "PRICE_SHOCK", updatedAt: new Date() });
    syntheticGetObservation.mockResolvedValueOnce({
      symbol: "INFY.NS",
      price: 1400,
      volume: 2_000_000,
      observedAt: new Date(),
      source: "SYNTHETIC",
    });
    observationRepositoryMock.save.mockImplementationOnce(async (raw, freshness) => ({
      id: "obs-shock",
      ...raw,
      receivedAt: new Date(),
      freshness,
    }));

    const result = await marketDataService.fetchObservation("INFY.NS");
    expect(syntheticGetObservation).toHaveBeenCalledWith("INFY.NS", "PRICE_SHOCK");
    expect(yahooGetObservation).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("bypasses the newest-wins guard for an active demo scenario, so switching scenarios always takes effect", async () => {
    demoScenarioRepositoryMock.get.mockResolvedValueOnce({ scenario: "STALE_DATA", updatedAt: new Date() });
    syntheticGetObservation.mockResolvedValueOnce({
      symbol: "INFY.NS",
      price: 1400,
      volume: 2_000_000,
      observedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // deliberately old
      source: "SYNTHETIC",
    });
    observationRepositoryMock.save.mockImplementationOnce(async (raw, freshness) => ({
      id: "obs-stale-override",
      ...raw,
      receivedAt: new Date(),
      freshness,
    }));

    const result = await marketDataService.fetchObservation("INFY.NS");

    expect(observationRepositoryMock.save).toHaveBeenCalledOnce();
    expect(observationRepositoryMock.saveIfNewer).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.observation.freshness).toBe("STALE");
  });

  it("skips the live provider call when the market is closed and we already have this session's close", async () => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z")); // Friday, 17:30 IST — closed
    observationRepositoryMock.latestFor.mockResolvedValueOnce({
      id: "obs-close",
      symbol: "INFY.NS",
      price: 1130,
      volume: 5_000_000,
      observedAt: new Date("2026-09-04T09:45:00Z"), // today's last trade
      receivedAt: new Date("2026-09-04T09:45:01Z"),
      source: "YAHOO",
      freshness: "CLOSED",
    });

    const result = await marketDataService.fetchObservation("INFY.NS");

    expect(yahooGetObservation).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.freshness).toBe("CLOSED");
      expect(result.observation.price).toBe(1130);
    }
  });

  it("still calls the provider when the market is closed but stored data predates a scenario reset back to normal", async () => {
    // Regression test: a demo scenario override (e.g. PRICE_SHOCK) writes
    // a row via observationRepository.save. If the scenario is later reset
    // to NORMAL_MARKET while the market stays closed, the closed-market
    // skip must not keep reusing that override-tainted row forever — it
    // should notice the row predates the reset and fetch fresh.
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    demoScenarioRepositoryMock.get.mockResolvedValueOnce({
      scenario: "NORMAL_MARKET",
      updatedAt: new Date("2026-09-04T11:00:00Z"), // reset happened after the cached row below
    });
    observationRepositoryMock.latestFor.mockResolvedValueOnce({
      id: "obs-shocked",
      symbol: "INFY.NS",
      price: 1628.18, // the shocked price, still on record from before the reset
      volume: 5_000_000,
      observedAt: new Date("2026-09-04T09:45:00Z"),
      receivedAt: new Date("2026-09-04T10:00:00Z"), // before scenarioUpdatedAt
      source: "SYNTHETIC",
      freshness: "CLOSED",
    });
    yahooGetObservation.mockResolvedValueOnce({
      symbol: "INFY.NS",
      price: 1494.62, // the genuine normal price
      volume: 8_000_000,
      observedAt: new Date("2026-09-04T09:45:00Z"),
      source: "YAHOO",
    });
    observationRepositoryMock.saveIfNewer.mockImplementationOnce(async (raw, freshness) => ({
      id: "obs-fresh",
      ...raw,
      receivedAt: new Date(),
      freshness,
    }));

    const result = await marketDataService.fetchObservation("INFY.NS");

    expect(yahooGetObservation).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.observation.price).toBe(1494.62);
  });

  it("still calls the provider when the market is closed but stored data predates the most recent session", async () => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    observationRepositoryMock.latestFor.mockResolvedValueOnce({
      id: "obs-old",
      symbol: "INFY.NS",
      price: 1000,
      volume: 1_000_000,
      observedAt: new Date("2026-09-01T09:45:00Z"), // days before the most recent session
      receivedAt: new Date("2026-09-01T09:45:01Z"),
      source: "YAHOO",
      freshness: "CLOSED",
    });
    yahooGetObservation.mockResolvedValueOnce({
      symbol: "INFY.NS",
      price: 1130,
      volume: 5_000_000,
      observedAt: new Date("2026-09-04T09:45:00Z"),
      source: "YAHOO",
    });
    observationRepositoryMock.saveIfNewer.mockImplementationOnce(async (raw, freshness) => ({
      id: "obs-new",
      ...raw,
      receivedAt: new Date(),
      freshness,
    }));

    const result = await marketDataService.fetchObservation("INFY.NS");

    expect(yahooGetObservation).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
  });

  it("does not apply the closed-market skip to an active demo scenario override", async () => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    demoScenarioRepositoryMock.get.mockResolvedValueOnce({ scenario: "PRICE_SHOCK", updatedAt: new Date() });
    observationRepositoryMock.latestFor.mockResolvedValueOnce({
      id: "obs-close",
      symbol: "INFY.NS",
      price: 1130,
      volume: 5_000_000,
      observedAt: new Date("2026-09-04T09:45:00Z"),
      receivedAt: new Date("2026-09-04T09:45:01Z"),
      source: "YAHOO",
      freshness: "CLOSED",
    });
    syntheticGetObservation.mockResolvedValueOnce({
      symbol: "INFY.NS",
      price: 1400,
      volume: 2_000_000,
      observedAt: new Date("2026-09-04T10:00:00Z"),
      source: "SYNTHETIC",
    });
    observationRepositoryMock.save.mockImplementationOnce(async (raw, freshness) => ({
      id: "obs-shock",
      ...raw,
      receivedAt: new Date(),
      freshness,
    }));

    const result = await marketDataService.fetchObservation("INFY.NS");

    expect(syntheticGetObservation).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
  });
});

describe("marketDataService.fetchHistorical", () => {
  it("skips the provider call when the DB already fully covers the requested trading days", async () => {
    const { lastNTradingDays } = await import("@/server/domain/tradingDays");
    const wantedDays = lastNTradingDays(new Date(), 5);
    historicalRepositoryMock.getRecent.mockResolvedValueOnce(
      wantedDays.map((d) => ({ symbol: "INFY.NS", date: d, close: 100, volume: 1000 })),
    );

    const bars = await marketDataService.fetchHistorical("INFY.NS", 5);

    expect(yahooGetHistorical).not.toHaveBeenCalled();
    expect(bars).toHaveLength(5);
  });

  it("calls the provider and persists the result when coverage is incomplete", async () => {
    historicalRepositoryMock.getRecent.mockResolvedValueOnce([]);
    yahooGetHistorical.mockResolvedValueOnce([
      { symbol: "INFY.NS", date: new Date("2026-09-03T03:45:00Z"), close: 1130, volume: 5_000_000 },
    ]);

    const bars = await marketDataService.fetchHistorical("INFY.NS", 5);

    expect(yahooGetHistorical).toHaveBeenCalledOnce();
    expect(historicalRepositoryMock.upsertMany).toHaveBeenCalledOnce();
    expect(bars).toHaveLength(1);
  });

  it("falls back to whatever's already stored if the provider call fails", async () => {
    const existing = [{ symbol: "INFY.NS", date: new Date("2026-09-03T03:45:00Z"), close: 1130, volume: 5_000_000 }];
    historicalRepositoryMock.getRecent.mockResolvedValueOnce(existing);
    yahooGetHistorical.mockRejectedValueOnce(new MarketDataError("boom", "INFY.NS"));

    const bars = await marketDataService.fetchHistorical("INFY.NS", 5);

    expect(bars).toEqual(existing);
  });
});

describe("classifyFreshness", () => {
  const marketOpen = new Date("2026-09-04T06:00:00Z"); // Friday, 11:30 IST
  const marketClosedAfterHours = new Date("2026-09-04T12:00:00Z"); // Friday, 17:30 IST
  const mondayPreOpen = new Date("2026-09-07T02:00:00Z"); // Monday, 07:30 IST

  it("is LIVE for a recent observation while the market is open", () => {
    const observedAt = new Date(marketOpen.getTime() - 5 * 60 * 1000);
    expect(classifyFreshness(observedAt, marketOpen)).toBe("LIVE");
  });

  it("is DELAYED for an older-but-same-session observation while the market is open", () => {
    const observedAt = new Date(marketOpen.getTime() - 60 * 60 * 1000);
    expect(classifyFreshness(observedAt, marketOpen)).toBe("DELAYED");
  });

  it("is STALE if data hasn't updated in hours while the market is open", () => {
    const observedAt = new Date(marketOpen.getTime() - 7 * 60 * 60 * 1000);
    expect(classifyFreshness(observedAt, marketOpen)).toBe("STALE");
  });

  it("is never LIVE once the market has closed, even for a very recent timestamp", () => {
    const observedAt = new Date(marketClosedAfterHours.getTime() - 2 * 60 * 1000);
    expect(classifyFreshness(observedAt, marketClosedAfterHours)).not.toBe("LIVE");
    expect(classifyFreshness(observedAt, marketClosedAfterHours)).toBe("CLOSED");
  });

  it("labels today's close as CLOSED right after the market closes", () => {
    const observedAt = new Date("2026-09-04T09:45:00Z"); // 15:15 IST, just before close
    expect(classifyFreshness(observedAt, marketClosedAfterHours)).toBe("CLOSED");
  });

  it("labels Friday's close as CLOSED on Monday morning before the market opens", () => {
    const fridayClose = new Date("2026-09-04T09:50:00Z"); // Friday, 15:20 IST
    expect(classifyFreshness(fridayClose, mondayPreOpen)).toBe("CLOSED");
  });

  it("labels data older than the most recent session as STALE while the market is closed", () => {
    const twoTradingDaysAgo = new Date("2026-09-02T09:50:00Z"); // Wednesday close
    expect(classifyFreshness(twoTradingDaysAgo, mondayPreOpen)).toBe("STALE");
  });
});
