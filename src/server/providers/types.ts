import type { DemoScenario, HistoricalBar, RawObservation } from "@/server/domain/types";

/**
 * Everything the rest of the app knows about market data providers. Business
 * logic (Market Data Service, Change Engine) depends only on this interface,
 * never on a concrete vendor — that's what lets the synthetic provider serve
 * as the sole real implementation today, with a genuine external provider
 * pluggable behind the same interface later without touching anything else.
 */
export interface IMarketDataProvider {
  /** Latest quote for a symbol. Throws MarketDataError on any failure. */
  getObservation(symbol: string, scenario?: DemoScenario): Promise<RawObservation>;

  /** Up to `days` most recent *completed* trading day bars, oldest first.
   * Throws MarketDataError on failure. Returns an empty array (not an
   * error) if the provider legitimately has no history for the symbol. */
  getHistorical(symbol: string, days: number): Promise<HistoricalBar[]>;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly symbol: string,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}
