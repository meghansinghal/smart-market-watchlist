/** Company display name + sector label for a curated set of well-known NSE
 * symbols. Originally display-only, this list is now also the whitelist
 * `watchlistService.add` (server-side) checks a symbol against: with only
 * the synthetic provider wired up (see marketDataService), there's no
 * external source of truth left to verify a ticker actually exists, and
 * the synthetic provider is designed to generate plausible-looking data
 * for *any* string — so without a whitelist, a typo or made-up symbol like
 * "HELLO.KS" would sail onto a watchlist same as a real one. Plain data,
 * safe to import from server code too (server/domain/sectors.ts has its
 * own, separate symbol→sector mapping that drives benchmark selection for
 * the 5 originally-seeded symbols specifically; this list is broader and
 * only concerned with "is this a name we recognize"). */
interface KnownSymbol {
  symbol: string;
  name: string;
  sector: string;
}

const KNOWN_SYMBOLS: KnownSymbol[] = [
  { symbol: "INFY.NS", name: "Infosys", sector: "IT" },
  { symbol: "TCS.NS", name: "Tata Consultancy", sector: "IT" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", sector: "Banking" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", sector: "Banking" },
  { symbol: "RELIANCE.NS", name: "Reliance Industries", sector: "Energy" },
  { symbol: "WIPRO.NS", name: "Wipro", sector: "IT" },
  { symbol: "HCLTECH.NS", name: "HCL Technologies", sector: "IT" },
  { symbol: "TMPV.NS", name: "Tata Motors Passenger Vehicles", sector: "Auto" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki", sector: "Auto" },
  { symbol: "SBIN.NS", name: "State Bank of India", sector: "Banking" },
  { symbol: "AXISBANK.NS", name: "Axis Bank", sector: "Banking" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", sector: "Banking" },
  { symbol: "BAJFINANCE.NS", name: "Bajaj Finance", sector: "Financial Services" },
  { symbol: "ITC.NS", name: "ITC", sector: "FMCG" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever", sector: "FMCG" },
  { symbol: "NESTLEIND.NS", name: "Nestle India", sector: "FMCG" },
  { symbol: "ASIANPAINT.NS", name: "Asian Paints", sector: "FMCG" },
  { symbol: "TITAN.NS", name: "Titan Company", sector: "Consumer Goods" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel", sector: "Telecom" },
  { symbol: "LT.NS", name: "Larsen & Toubro", sector: "Infrastructure" },
  { symbol: "SUNPHARMA.NS", name: "Sun Pharmaceutical", sector: "Pharma" },
  { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement", sector: "Cement" },
  { symbol: "ONGC.NS", name: "Oil & Natural Gas Corp", sector: "Energy" },
  { symbol: "NTPC.NS", name: "NTPC", sector: "Utilities" },
  { symbol: "POWERGRID.NS", name: "Power Grid Corp", sector: "Utilities" },
];

const SYMBOL_INFO = new Map(KNOWN_SYMBOLS.map((s) => [s.symbol, s]));

export function displayNameFor(symbol: string): string | null {
  return SYMBOL_INFO.get(symbol)?.name ?? null;
}

export function sectorLabelFor(symbol: string): string | null {
  return SYMBOL_INFO.get(symbol)?.sector ?? null;
}

export function isKnownSymbol(symbol: string): boolean {
  return SYMBOL_INFO.has(symbol);
}

/** Known symbols whose ticker or company name *starts with* the typed
 * text (not a substring match anywhere) — powers the "add a symbol"
 * autocomplete, so typing "tata" surfaces Tata-prefixed names without also
 * pulling in unrelated matches that merely contain those letters. */
export function searchKnownSymbols(query: string, limit = 6): KnownSymbol[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return KNOWN_SYMBOLS.filter(
    (s) => s.symbol.toLowerCase().startsWith(q) || s.name.toLowerCase().startsWith(q),
  ).slice(0, limit);
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
