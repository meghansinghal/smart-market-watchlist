/**
 * Static symbol → sector → benchmark index mapping.
 *
 * The Meaningful Change Engine wants to know whether a stock's move is
 * "just the sector moving" or genuinely idiosyncratic. Yahoo Finance has
 * decent coverage of a couple of NSE sector indices; anything without a
 * dedicated sector benchmark falls back to the broad NIFTY 50 index, which
 * always exists.
 */

export const NIFTY_50 = "^NSEI";

const SECTOR_BENCHMARKS: Record<string, string> = {
  IT: "^CNXIT",
  BANKING: "^NSEBANK",
};

const SYMBOL_SECTORS: Record<string, string> = {
  "INFY.NS": "IT",
  "TCS.NS": "IT",
  "HDFCBANK.NS": "BANKING",
  "ICICIBANK.NS": "BANKING",
  "RELIANCE.NS": "ENERGY",
};

export function sectorFor(symbol: string): string | null {
  return SYMBOL_SECTORS[symbol] ?? null;
}

/** The benchmark to diverge against for a given symbol. Always resolves to
 * *something* — falls back to NIFTY 50 when there's no sector-specific
 * index, or when the symbol's sector is unknown. */
export function benchmarkFor(symbol: string): string {
  const sector = sectorFor(symbol);
  if (!sector) return NIFTY_50;
  return SECTOR_BENCHMARKS[sector] ?? NIFTY_50;
}
