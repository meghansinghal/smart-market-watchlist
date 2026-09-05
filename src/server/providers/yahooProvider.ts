import YahooFinance from "yahoo-finance2";
import type { HistoricalBar, RawObservation } from "@/server/domain/types";
import { lastNTradingDays } from "@/server/domain/tradingDays";
import { ConcurrencyLimiter } from "@/server/providers/concurrencyLimiter";
import { MarketDataError, type IMarketDataProvider } from "@/server/providers/types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Yahoo's unofficial API rate-limits by request burst more than by steady
// volume — capping how many calls run at once (across every symbol and
// benchmark index fetched for a dashboard load) matters more here than
// raw throughput.
const requestLimiter = new ConcurrencyLimiter(2);

async function withTimeout<T>(promise: Promise<T>, ms: number, symbol: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new MarketDataError(`Yahoo Finance timed out for ${symbol}`, "TIMEOUT", symbol));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

function toMarketDataError(err: unknown, symbol: string): MarketDataError {
  if (err instanceof MarketDataError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/rate limit|429|too many requests/i.test(message)) {
    return new MarketDataError(message, "RATE_LIMITED", symbol);
  }
  if (/not found|404|no data/i.test(message)) {
    return new MarketDataError(message, "NOT_FOUND", symbol);
  }
  return new MarketDataError(message, "UNKNOWN", symbol);
}

/** Yahoo Finance is treated as an unreliable external dependency: every
 * call is bounded by a timeout and any failure is normalized into a
 * MarketDataError so the Market Data Service can decide how to fall back. */
export class YahooMarketDataProvider implements IMarketDataProvider {
  constructor(private readonly timeoutMs: number = 5000) {}

  async getObservation(symbol: string): Promise<RawObservation> {
    return requestLimiter.run(async () => {
      try {
        const quote = await withTimeout(
          yahooFinance.quote(symbol),
          this.timeoutMs,
          symbol,
        );
        if (!quote || typeof quote.regularMarketPrice !== "number") {
          throw new MarketDataError(`No quote data for ${symbol}`, "NOT_FOUND", symbol);
        }
        return {
          symbol,
          price: quote.regularMarketPrice,
          volume:
            typeof quote.regularMarketVolume === "number" ? quote.regularMarketVolume : null,
          observedAt: quote.regularMarketTime ?? new Date(),
          source: "YAHOO",
        };
      } catch (err) {
        throw toMarketDataError(err, symbol);
      }
    });
  }

  async getHistorical(symbol: string, days: number): Promise<HistoricalBar[]> {
    return requestLimiter.run(async () => {
      try {
        const now = new Date();
        const tradingDays = lastNTradingDays(now, days);
        const period1 = tradingDays[0];
        // Yahoo's chart range is period1-inclusive but treats period2 as
        // "up to right now" if given the current instant — which pulls in
        // today's still-forming bar. `lastNTradingDays` explicitly excludes
        // today (the in-progress/live day, see its own doc comment), so
        // cap period2 at today's midnight to keep this in sync with that
        // contract instead of silently returning one extra (N+1th) bar.
        const period2 = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );
        const result = await withTimeout(
          yahooFinance.chart(symbol, { period1, period2, interval: "1d", return: "array" }),
          this.timeoutMs,
          symbol,
        );
        return result.quotes
          .filter((q) => typeof q.close === "number")
          .map((q) => ({
            symbol,
            date: q.date,
            close: q.close as number,
            volume: typeof q.volume === "number" ? q.volume : null,
          }));
      } catch (err) {
        throw toMarketDataError(err, symbol);
      }
    });
  }
}
