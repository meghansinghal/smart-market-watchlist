/** Company display name + sector label for the known watchlist symbols —
 * pure presentation, not business logic, so it lives client-side rather
 * than threading through the API (the server's own symbol→sector mapping
 * that actually drives benchmark selection lives separately in
 * server/domain/sectors.ts; this is a display-only mirror of the same
 * few known symbols). Unknown symbols (arbitrary tickers a user adds)
 * simply get no subtitle — they still work fully, just without a
 * friendly name. */
const SYMBOL_INFO: Record<string, { name: string; sector: string }> = {
  "INFY.NS": { name: "Infosys", sector: "IT" },
  "TCS.NS": { name: "Tata Consultancy", sector: "IT" },
  "HDFCBANK.NS": { name: "HDFC Bank", sector: "Banking" },
  "ICICIBANK.NS": { name: "ICICI Bank", sector: "Banking" },
  "RELIANCE.NS": { name: "Reliance Industries", sector: "Energy" },
};

export function displayNameFor(symbol: string): string | null {
  return SYMBOL_INFO[symbol]?.name ?? null;
}

export function sectorLabelFor(symbol: string): string | null {
  return SYMBOL_INFO[symbol]?.sector ?? null;
}

// Mirrors server/domain/sectors.ts's small, fixed set of benchmark index
// symbols — display-only, same reasoning as SYMBOL_INFO above.
const BENCHMARK_NAMES: Record<string, string> = {
  "^NSEI": "NIFTY 50",
  "^CNXIT": "NIFTY IT",
  "^NSEBANK": "NIFTY BANK",
};

export function benchmarkNameFor(symbol: string): string {
  return BENCHMARK_NAMES[symbol] ?? symbol;
}
