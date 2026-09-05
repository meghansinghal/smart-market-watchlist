import { prisma } from "@/lib/prisma";
import type { HistoricalBar } from "@/server/domain/types";

function toDomain(row: { symbol: string; date: Date; close: number; volume: bigint | null }): HistoricalBar {
  return {
    symbol: row.symbol,
    date: row.date,
    close: row.close,
    volume: row.volume === null ? null : Number(row.volume),
  };
}

export const historicalRepository = {
  async getRecent(symbol: string, days: number): Promise<HistoricalBar[]> {
    const rows = await prisma.historicalBar.findMany({
      where: { symbol },
      orderBy: { date: "desc" },
      take: days,
    });
    return rows.map(toDomain).reverse();
  },

  /** Upsert bars keyed by (symbol, date) — safe to call repeatedly with
   * overlapping ranges, and never destroys bars outside the given range. */
  async upsertMany(bars: HistoricalBar[]): Promise<void> {
    for (const bar of bars) {
      await prisma.historicalBar.upsert({
        where: { symbol_date: { symbol: bar.symbol, date: bar.date } },
        create: {
          symbol: bar.symbol,
          date: bar.date,
          close: bar.close,
          volume: bar.volume === null ? null : BigInt(bar.volume),
        },
        update: {
          close: bar.close,
          volume: bar.volume === null ? null : BigInt(bar.volume),
        },
      });
    }
  },
};
