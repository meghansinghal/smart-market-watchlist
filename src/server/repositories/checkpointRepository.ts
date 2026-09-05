import { prisma } from "@/lib/prisma";
import type { Checkpoint, MarketObservation } from "@/server/domain/types";

function toDomain(row: {
  symbol: string;
  price: number;
  volume: bigint | null;
  observedAt: Date;
  source: string;
  freshness: string;
  checkedAt: Date;
}): Checkpoint {
  return {
    symbol: row.symbol,
    price: row.price,
    volume: row.volume === null ? null : Number(row.volume),
    observedAt: row.observedAt,
    source: row.source as Checkpoint["source"],
    freshness: row.freshness as Checkpoint["freshness"],
    checkedAt: row.checkedAt,
  };
}

export const checkpointRepository = {
  async get(symbol: string): Promise<Checkpoint | null> {
    const row = await prisma.checkpoint.findUnique({ where: { symbol } });
    return row ? toDomain(row) : null;
  },

  async getMany(symbols: string[]): Promise<Map<string, Checkpoint>> {
    if (symbols.length === 0) return new Map();
    const rows = await prisma.checkpoint.findMany({ where: { symbol: { in: symbols } } });
    return new Map(rows.map((r) => [r.symbol, toDomain(r)]));
  },

  /** Set a symbol's checkpoint to a specific observation. Callers are
   * responsible for only calling this with valid, non-stale data — the
   * repository doesn't second-guess freshness itself, since "is this good
   * enough to checkpoint" is a policy decision that belongs to the
   * Checkpoint Service. */
  async set(observation: MarketObservation): Promise<Checkpoint> {
    const row = await prisma.checkpoint.upsert({
      where: { symbol: observation.symbol },
      create: {
        symbol: observation.symbol,
        price: observation.price,
        volume: observation.volume === null ? null : BigInt(observation.volume),
        observedAt: observation.observedAt,
        source: observation.source,
        freshness: observation.freshness,
      },
      update: {
        price: observation.price,
        volume: observation.volume === null ? null : BigInt(observation.volume),
        observedAt: observation.observedAt,
        source: observation.source,
        freshness: observation.freshness,
        checkedAt: new Date(),
      },
    });
    return toDomain(row);
  },

  async remove(symbol: string): Promise<void> {
    await prisma.checkpoint.deleteMany({ where: { symbol } });
  },
};
