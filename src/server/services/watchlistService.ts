import { isKnownSymbol } from "@/lib/displayNames";
import { checkpointRepository } from "@/server/repositories/checkpointRepository";
import { watchlistRepository, type WatchlistItemDTO } from "@/server/repositories/watchlistRepository";

/** NSE-style ticker: letters/digits/./^/- , 1–15 chars. Loose on purpose —
 * the synthetic provider accepts arbitrary symbols for demo purposes. */
const SYMBOL_PATTERN = /^[A-Z0-9^.\-]{1,15}$/;

export class InvalidSymbolError extends Error {}

function normalizeSymbol(raw: string): string {
  const symbol = raw.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new InvalidSymbolError(`"${raw}" doesn't look like a valid ticker symbol`);
  }
  return symbol;
}

export const watchlistService = {
  async list(userId: string): Promise<WatchlistItemDTO[]> {
    return watchlistRepository.list(userId);
  },

  /** Idempotent by design — adding a symbol already on the user's watchlist
   * is a no-op rather than an error, so duplicate entries can't happen.
   *
   * `normalizeSymbol` only checks the *shape* of a ticker, not whether it's
   * a real company — with only the synthetic provider wired up, there's no
   * external source of truth left to check that against, and the
   * synthetic provider happily generates plausible-looking data for any
   * string by design. So a typo or made-up symbol is only caught here by
   * checking it against the curated known-symbol list (the same one
   * powering the "add a symbol" autocomplete) — see lib/displayNames.ts.
   * If a real provider is ever added back behind IMarketDataProvider, that
   * gives a genuine source of truth again and this whitelist could be
   * loosened back to a shape-only check. */
  async add(userId: string, rawSymbol: string): Promise<WatchlistItemDTO> {
    const symbol = normalizeSymbol(rawSymbol);
    if (!isKnownSymbol(symbol)) {
      throw new InvalidSymbolError(`"${symbol}" isn't a recognized symbol — pick one from the suggestions.`);
    }
    return watchlistRepository.add(userId, symbol);
  },

  async remove(userId: string, rawSymbol: string): Promise<void> {
    const symbol = normalizeSymbol(rawSymbol);
    await watchlistRepository.remove(userId, symbol);
    // The checkpoint is this user's visit state for a symbol they were
    // tracking; once removed, stale checkpoint data shouldn't linger and
    // resurrect a misleading "change" if the symbol is ever re-added.
    await checkpointRepository.remove(userId, symbol);
  },
};
