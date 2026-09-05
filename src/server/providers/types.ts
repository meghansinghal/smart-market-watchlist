import type { DemoScenario, HistoricalBar, RawObservation } from "@/server/domain/types";

/**
 * Everything the rest of the app knows about market data providers. Business
 * logic (Market Data Service, Change Engine) depends only on this interface,
 * never on Yahoo or any other concrete vendor — that's what lets us swap in
 * a synthetic provider for demos/tests without touching anything else.
 */
export interface IMarketDataProvider {
  /** Latest quote for a symbol. Throws MarketDataError on any failure. */
  getObservation(symbol: string, scenario?: DemoScenario): Promise<RawObservation>;

  /** Up to `days` most recent *completed* trading day bars, oldest first.
   * Throws MarketDataError on failure. Returns an empty array (not an
   * error) if the provider legitimately has no history for the symbol. */
  getHistorical(symbol: string, days: number): Promise<HistoricalBar[]>;
}

export type MarketDataErrorCode = "TIMEOUT" | "RATE_LIMITED" | "NOT_FOUND" | "UNKNOWN";

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly code: MarketDataErrorCode,
    public readonly symbol: string,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}
