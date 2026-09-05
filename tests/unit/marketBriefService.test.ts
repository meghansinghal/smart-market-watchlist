import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Checkpoint, MarketObservation } from "@/server/domain/types";

const fetchObservation = vi.fn();
const fetchHistorical = vi.fn();
const checkpointGet = vi.fn();

vi.mock("@/server/services/marketDataService", () => ({
  marketDataService: { fetchObservation, fetchHistorical },
}));
vi.mock("@/server/repositories/checkpointRepository", () => ({
  checkpointRepository: { get: checkpointGet },
}));

const { marketBriefService } = await import("@/server/services/marketBriefService");

function observation(overrides: Partial<MarketObservation> = {}): MarketObservation {
  return {
    id: "obs-shared",
    symbol: "TCS.NS",
    price: 4300,
    volume: 5_000_000,
    observedAt: new Date("2026-09-04T10:00:00Z"),
    receivedAt: new Date("2026-09-04T10:00:00Z"),
    source: "SYNTHETIC",
    freshness: "CLOSED",
    ...overrides,
  };
}

function checkpoint(price: number): Checkpoint {
  return {
    symbol: "TCS.NS",
    price,
    volume: 5_000_000,
    observedAt: new Date("2026-09-03T10:00:00Z"),
    source: "SYNTHETIC",
    freshness: "CLOSED",
    checkedAt: new Date("2026-09-03T10:00:00Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Flat, unmoving benchmark — isolates the stock's own move for
  // classification purposes.
  fetchObservation.mockImplementation(async (symbol: string) =>
    symbol === "TCS.NS"
      ? { ok: true, observation: observation() }
      : { ok: true, observation: observation({ id: "obs-bench", symbol, price: 100 }) },
  );
  fetchHistorical.mockImplementation(async (symbol: string) =>
    Array.from({ length: 20 }, (_, i) => ({
      symbol,
      date: new Date(Date.UTC(2026, 7, 10 + i)),
      close: symbol === "TCS.NS" ? 4300 : 100,
      volume: 5_000_000,
    })),
  );
});

describe("marketBriefService — per-user checkpoint isolation over shared market data", () => {
  it("two users derive different classifications from the identical shared observation, purely from their own checkpoint", async () => {
    checkpointGet.mockImplementation(async (userId: string) =>
      userId === "alice-with-matching-checkpoint" ? checkpoint(4300) : checkpoint(3900),
    );

    const aliceBrief = await marketBriefService.getSymbolBrief("alice-with-matching-checkpoint", "TCS.NS");
    const bobBrief = await marketBriefService.getSymbolBrief("bob-with-stale-checkpoint", "TCS.NS");

    // Same underlying observation for both — proves the shared-market-data
    // half of the architecture.
    expect(aliceBrief.observation).toEqual(bobBrief.observation);

    // But different checkpoints (each fetched with that user's own id)
    // yield different conclusions — proves the per-user half.
    expect(checkpointGet).toHaveBeenCalledWith("alice-with-matching-checkpoint", "TCS.NS");
    expect(checkpointGet).toHaveBeenCalledWith("bob-with-stale-checkpoint", "TCS.NS");
    expect(aliceBrief.change?.pctChangeSinceCheckpoint).toBe(0);
    expect(aliceBrief.change?.classification).toBe("NORMAL");
    expect(bobBrief.change?.classification).toBe("SIGNIFICANT");
  });
});
