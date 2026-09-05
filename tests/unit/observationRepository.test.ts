import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory fake standing in for the pieces of PrismaClient the
// repository touches, so we can assert the out-of-order guarantee without
// a real database.
interface Row {
  id: string;
  symbol: string;
  price: number;
  volume: bigint | null;
  observedAt: Date;
  receivedAt: Date;
  source: string;
  freshness: string;
}

let rows: Row[] = [];
let nextId = 1;

const marketObservation = {
  findFirst: vi.fn(async ({ where }: { where: { symbol: string } }) => {
    const matches = rows
      .filter((r) => r.symbol === where.symbol)
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
    return matches[0] ?? null;
  }),
  create: vi.fn(async ({ data }: { data: Omit<Row, "id" | "receivedAt"> }) => {
    const row: Row = { id: `obs-${nextId++}`, receivedAt: new Date(), ...data };
    rows.push(row);
    return row;
  }),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    marketObservation,
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ marketObservation }),
  },
}));

const { observationRepository } = await import("@/server/repositories/observationRepository");

beforeEach(() => {
  rows = [];
  nextId = 1;
  vi.clearAllMocks();
});

describe("observationRepository.saveIfNewer", () => {
  it("persists a fresh observation when nothing exists yet", async () => {
    const saved = await observationRepository.saveIfNewer(
      { symbol: "INFY.NS", price: 1600, volume: 1000, observedAt: new Date("2026-09-04T10:00:00Z"), source: "SYNTHETIC" },
      "LIVE",
    );
    expect(saved.price).toBe(1600);
    expect(rows).toHaveLength(1);
  });

  it("never lets an older observation overwrite a newer one", async () => {
    await observationRepository.saveIfNewer(
      { symbol: "INFY.NS", price: 1600, volume: 1000, observedAt: new Date("2026-09-04T10:00:00Z"), source: "SYNTHETIC" },
      "LIVE",
    );

    const staleResult = await observationRepository.saveIfNewer(
      { symbol: "INFY.NS", price: 1550, volume: 900, observedAt: new Date("2026-09-04T09:00:00Z"), source: "SYNTHETIC" },
      "LIVE",
    );

    expect(staleResult.price).toBe(1600); // the newer row, untouched
    expect(rows).toHaveLength(1); // no duplicate/overwriting row was created
  });

  it("accepts a genuinely newer observation", async () => {
    await observationRepository.saveIfNewer(
      { symbol: "INFY.NS", price: 1600, volume: 1000, observedAt: new Date("2026-09-04T10:00:00Z"), source: "SYNTHETIC" },
      "LIVE",
    );
    const newer = await observationRepository.saveIfNewer(
      { symbol: "INFY.NS", price: 1620, volume: 1100, observedAt: new Date("2026-09-04T11:00:00Z"), source: "SYNTHETIC" },
      "LIVE",
    );
    expect(newer.price).toBe(1620);
    expect(rows).toHaveLength(2);
  });
});

describe("observationRepository.save", () => {
  it("always inserts, even when older than what's already on record", async () => {
    await observationRepository.saveIfNewer(
      { symbol: "INFY.NS", price: 1600, volume: 1000, observedAt: new Date("2026-09-04T10:00:00Z"), source: "SYNTHETIC" },
      "LIVE",
    );
    const forced = await observationRepository.save(
      { symbol: "INFY.NS", price: 1400, volume: 500, observedAt: new Date("2026-09-02T10:00:00Z"), source: "SYNTHETIC" },
      "STALE",
    );
    expect(forced.price).toBe(1400);
    expect(rows).toHaveLength(2);
  });
});
