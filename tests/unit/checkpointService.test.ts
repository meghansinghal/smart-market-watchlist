import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketObservation } from "@/server/domain/types";

const observationRepositoryMock = { getById: vi.fn() };
const checkpointRepositoryMock = { set: vi.fn() };

vi.mock("@/server/repositories/observationRepository", () => ({
  observationRepository: observationRepositoryMock,
}));
vi.mock("@/server/repositories/checkpointRepository", () => ({
  checkpointRepository: checkpointRepositoryMock,
}));

const { checkpointService } = await import("@/server/services/checkpointService");

const USER_ID = "user-alice";

function observation(overrides: Partial<MarketObservation> = {}): MarketObservation {
  return {
    id: "obs-1",
    symbol: "INFY.NS",
    price: 1600,
    volume: 1_000_000,
    observedAt: new Date(),
    receivedAt: new Date(),
    source: "YAHOO",
    freshness: "LIVE",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkpointService.commit", () => {
  it("commits a checkpoint for a valid, fresh observation, scoped to the given user", async () => {
    const obs = observation();
    observationRepositoryMock.getById.mockResolvedValueOnce(obs);

    const [outcome] = await checkpointService.commit(USER_ID, [
      { symbol: "INFY.NS", observationId: "obs-1" },
    ]);

    expect(outcome.committed).toBe(true);
    expect(checkpointRepositoryMock.set).toHaveBeenCalledOnce();
    expect(checkpointRepositoryMock.set).toHaveBeenCalledWith(USER_ID, obs);
  });

  it("refuses to checkpoint stale data", async () => {
    observationRepositoryMock.getById.mockResolvedValueOnce(observation({ freshness: "STALE" }));

    const [outcome] = await checkpointService.commit(USER_ID, [
      { symbol: "INFY.NS", observationId: "obs-1" },
    ]);

    expect(outcome.committed).toBe(false);
    expect(checkpointRepositoryMock.set).not.toHaveBeenCalled();
  });

  it("refuses to checkpoint static/fallback snapshot data", async () => {
    observationRepositoryMock.getById.mockResolvedValueOnce(observation({ freshness: "STATIC" }));

    const [outcome] = await checkpointService.commit(USER_ID, [
      { symbol: "INFY.NS", observationId: "obs-1" },
    ]);

    expect(outcome.committed).toBe(false);
  });

  it("refuses to checkpoint when the observation can't be found (no silent no-op)", async () => {
    observationRepositoryMock.getById.mockResolvedValueOnce(null);

    const [outcome] = await checkpointService.commit(USER_ID, [
      { symbol: "INFY.NS", observationId: "missing" },
    ]);

    expect(outcome.committed).toBe(false);
    expect(outcome.reason).toBeDefined();
  });

  it("refuses to checkpoint when the observation belongs to a different symbol", async () => {
    observationRepositoryMock.getById.mockResolvedValueOnce(observation({ symbol: "TCS.NS" }));

    const [outcome] = await checkpointService.commit(USER_ID, [
      { symbol: "INFY.NS", observationId: "obs-1" },
    ]);

    expect(outcome.committed).toBe(false);
  });

  it("processes multiple items independently, one bad item doesn't block the rest", async () => {
    observationRepositoryMock.getById
      .mockResolvedValueOnce(observation({ symbol: "INFY.NS" }))
      .mockResolvedValueOnce(observation({ symbol: "TCS.NS", freshness: "STALE" }));

    const outcomes = await checkpointService.commit(USER_ID, [
      { symbol: "INFY.NS", observationId: "obs-1" },
      { symbol: "TCS.NS", observationId: "obs-2" },
    ]);

    expect(outcomes[0].committed).toBe(true);
    expect(outcomes[1].committed).toBe(false);
  });

  it("commits the same observation independently for two different users", async () => {
    const obs = observation();
    observationRepositoryMock.getById.mockResolvedValue(obs);

    await checkpointService.commit("user-alice", [{ symbol: "INFY.NS", observationId: "obs-1" }]);
    await checkpointService.commit("user-bob", [{ symbol: "INFY.NS", observationId: "obs-1" }]);

    expect(checkpointRepositoryMock.set).toHaveBeenNthCalledWith(1, "user-alice", obs);
    expect(checkpointRepositoryMock.set).toHaveBeenNthCalledWith(2, "user-bob", obs);
  });
});
