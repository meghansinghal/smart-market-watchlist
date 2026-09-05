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

/**
 * Every checkpoint belongs to exactly one user (composite key
 * userId+symbol) — this is what makes "what changed since you last
 * looked" personal per user rather than shared. The underlying
 * MarketObservation being compared against is still the same for everyone;
 * only the "what did I last see" side of the comparison is per-user.
 */
export const checkpointRepository = {
  async get(userId: string, symbol: string): Promise<Checkpoint | null> {
    const row = await prisma.checkpoint.findUnique({ where: { userId_symbol: { userId, symbol } } });
    return row ? toDomain(row) : null;
  },

  /** Set a user's checkpoint for a symbol to a specific observation.
   * Callers are responsible for only calling this with valid, non-stale
   * data — the repository doesn't second-guess freshness itself, since "is
   * this good enough to checkpoint" is a policy decision that belongs to
   * the Checkpoint Service. */
  async set(userId: string, observation: MarketObservation): Promise<Checkpoint> {
    const row = await prisma.checkpoint.upsert({
      where: { userId_symbol: { userId, symbol: observation.symbol } },
      create: {
        userId,
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

  async remove(userId: string, symbol: string): Promise<void> {
    await prisma.checkpoint.deleteMany({ where: { userId, symbol } });
  },
};
