import type { RawObservation } from "@/server/domain/types";

/**
 * Bundled last-resort snapshot. This is the final rung of the fallback
 * ladder (configured provider → latest valid cache → this file →
 * unavailable) — used only when the provider call fails *and* we have
 * never successfully cached an observation for the symbol (e.g. a brand
 * new deployment with an empty database). It is deliberately small,
 * clearly dated, and always reported to the UI with freshness "STATIC" so
 * it's never mistaken for live data.
 */
const SNAPSHOT_OBSERVED_AT = new Date("2026-08-28T10:00:00.000Z");

const STATIC_PRICES: Record<string, { price: number; volume: number }> = {
  "INFY.NS": { price: 1512.4, volume: 8_120_000 },
  "TCS.NS": { price: 3782.15, volume: 2_650_000 },
  "RELIANCE.NS": { price: 2931.6, volume: 5_980_000 },
  "HDFCBANK.NS": { price: 1642.3, volume: 8_740_000 },
  "ICICIBANK.NS": { price: 1211.9, volume: 7_260_000 },
  "^NSEI": { price: 24712.3, volume: 0 },
  "^CNXIT": { price: 38210.5, volume: 0 },
  "^NSEBANK": { price: 51340.75, volume: 0 },
};

export function getStaticSnapshot(symbol: string): RawObservation | null {
  const entry = STATIC_PRICES[symbol];
  if (!entry) return null;
  return {
    symbol,
    price: entry.price,
    volume: entry.volume || null,
    observedAt: SNAPSHOT_OBSERVED_AT,
    source: "STATIC_SNAPSHOT",
  };
}
