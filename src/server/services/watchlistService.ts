import { checkpointRepository } from "@/server/repositories/checkpointRepository";
import { watchlistRepository, type WatchlistItemDTO } from "@/server/repositories/watchlistRepository";

/** Yahoo/NSE-style ticker: letters/digits/./^/- , 1–15 chars. Loose on
 * purpose — synthetic mode accepts arbitrary symbols for demo purposes. */
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
  async list(): Promise<WatchlistItemDTO[]> {
    return watchlistRepository.list();
  },

  /** Idempotent by design — adding a symbol already on the watchlist is a
   * no-op rather than an error, so duplicate entries can't happen. */
  async add(rawSymbol: string): Promise<WatchlistItemDTO> {
    const symbol = normalizeSymbol(rawSymbol);
    return watchlistRepository.add(symbol);
  },

  async remove(rawSymbol: string): Promise<void> {
    const symbol = normalizeSymbol(rawSymbol);
    await watchlistRepository.remove(symbol);
    // The checkpoint is user-visit state for a symbol we're tracking; once
    // removed, stale checkpoint data shouldn't linger and resurrect a
    // misleading "change" if the symbol is ever re-added.
    await checkpointRepository.remove(symbol);
  },
};
