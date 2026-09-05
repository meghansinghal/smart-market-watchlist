import { checkpointRepository } from "@/server/repositories/checkpointRepository";
import { watchlistRepository, type WatchlistItemDTO } from "@/server/repositories/watchlistRepository";
import { marketDataService } from "@/server/services/marketDataService";

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
  async list(userId: string): Promise<WatchlistItemDTO[]> {
    return watchlistRepository.list(userId);
  },

  /** Idempotent by design — adding a symbol already on the user's watchlist
   * is a no-op rather than an error, so duplicate entries can't happen.
   *
   * `normalizeSymbol` only checks the *shape* of a ticker, not whether it's
   * a real, tradeable instrument — that's deliberate, since synthetic mode
   * generates data for any symbol string. But that means a typo like
   * "HELLO.NS" would otherwise sail straight onto the watchlist. Probing
   * with fetchObservation (the same call every other read path already
   * makes) catches that: in synthetic mode it always succeeds, so demo
   * symbols keep working exactly as before; in Yahoo mode a nonexistent
   * symbol genuinely has no data anywhere in the fallback chain and is
   * rejected here instead of silently sitting on the watchlist. */
  async add(userId: string, rawSymbol: string): Promise<WatchlistItemDTO> {
    const symbol = normalizeSymbol(rawSymbol);
    const result = await marketDataService.fetchObservation(symbol);
    if (!result.ok) {
      throw new InvalidSymbolError(`Couldn't find market data for "${symbol}" — check the symbol is correct.`);
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
