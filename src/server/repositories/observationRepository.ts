import { prisma } from "@/lib/prisma";
import type { MarketObservation, RawObservation } from "@/server/domain/types";
import type { Prisma } from "@prisma/client";

function toDomain(row: {
  id: string;
  symbol: string;
  price: number;
  volume: bigint | null;
  observedAt: Date;
  receivedAt: Date;
  source: string;
  freshness: string;
}): MarketObservation {
  return {
    id: row.id,
    symbol: row.symbol,
    price: row.price,
    volume: row.volume === null ? null : Number(row.volume),
    observedAt: row.observedAt,
    receivedAt: row.receivedAt,
    source: row.source as MarketObservation["source"],
    freshness: row.freshness as MarketObservation["freshness"],
  };
}

export const observationRepository = {
  async getById(id: string): Promise<MarketObservation | null> {
    const row = await prisma.marketObservation.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  },

  /** Latest observation we have persisted for a symbol, regardless of
   * freshness — this is the "latest valid cache" fallback rung. */
  async latestFor(symbol: string): Promise<MarketObservation | null> {
    const row = await prisma.marketObservation.findFirst({
      where: { symbol },
      orderBy: { observedAt: "desc" },
    });
    return row ? toDomain(row) : null;
  },

  /**
   * Persist a newly fetched observation, but only if it's not older than
   * what we already have — an out-of-order/delayed response must never
   * clobber a more recent one.
   */
  async saveIfNewer(
    raw: RawObservation,
    freshness: MarketObservation["freshness"],
  ): Promise<MarketObservation> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const latest = await tx.marketObservation.findFirst({
        where: { symbol: raw.symbol },
        orderBy: { observedAt: "desc" },
      });
      if (latest && latest.observedAt.getTime() > raw.observedAt.getTime()) {
        // We already have something newer; keep it as-is and just return it
        // rather than silently dropping the caller's data on the floor.
        return toDomain(latest);
      }
      const created = await tx.marketObservation.create({
        data: {
          symbol: raw.symbol,
          price: raw.price,
          volume: raw.volume === null ? null : BigInt(raw.volume),
          observedAt: raw.observedAt,
          source: raw.source,
          freshness,
        },
      });
      return toDomain(created);
    });
  },

  /**
   * Persist an observation unconditionally, bypassing the newest-wins
   * guard. For demo-scenario overrides only: those observations are a
   * deliberate, explicit simulated state (e.g. STALE_DATA fabricates an
   * old `observedAt` on purpose), not organic provider data racing with
   * itself, so switching scenarios must always take effect immediately
   * rather than losing to whatever real/prior observation is on record.
   */
  async save(
    raw: RawObservation,
    freshness: MarketObservation["freshness"],
  ): Promise<MarketObservation> {
    const created = await prisma.marketObservation.create({
      data: {
        symbol: raw.symbol,
        price: raw.price,
        volume: raw.volume === null ? null : BigInt(raw.volume),
        observedAt: raw.observedAt,
        source: raw.source,
        freshness,
      },
    });
    return toDomain(created);
  },
};
