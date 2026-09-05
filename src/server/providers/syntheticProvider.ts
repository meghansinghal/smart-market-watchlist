/**
 * Deterministic, offline market-data provider — used both as the default
 * data source in synthetic mode (MARKET_DATA_PROVIDER=synthetic) and as
 * the engine behind Market Simulation (see demoService/DemoScenario). A
 * `scenario` only changes what price/volume/timestamp this provider
 * generates; it produces an ordinary RawObservation that the rest of the
 * pipeline (persistence, freshness classification, the Meaningful Change
 * Engine) treats exactly like data from any other provider. Classification
 * is never assigned here.
 */
import type { DemoScenario, HistoricalBar, RawObservation } from "@/server/domain/types";
import { seededGaussian, seededRandom } from "@/server/domain/seededRandom";
import {
  atMarketClose,
  dateKey,
  isMarketLikelyOpen,
  lastNTradingDays,
  mostRecentMarketClose,
} from "@/server/domain/tradingDays";
import { MarketDataError, type IMarketDataProvider } from "@/server/providers/types";

interface SymbolProfile {
  basePrice: number;
  baseVolume: number;
  dailyVolatility: number; // stdev of daily returns, e.g. 0.012 = 1.2%
}

const KNOWN_PROFILES: Record<string, SymbolProfile> = {
  "INFY.NS": { basePrice: 1500, baseVolume: 8_500_000, dailyVolatility: 0.014 },
  "TCS.NS": { basePrice: 3800, baseVolume: 2_800_000, dailyVolatility: 0.011 },
  "RELIANCE.NS": { basePrice: 2900, baseVolume: 6_200_000, dailyVolatility: 0.013 },
  "HDFCBANK.NS": { basePrice: 1650, baseVolume: 9_000_000, dailyVolatility: 0.012 },
  "ICICIBANK.NS": { basePrice: 1200, baseVolume: 7_500_000, dailyVolatility: 0.013 },
  "^NSEI": { basePrice: 24500, baseVolume: 0, dailyVolatility: 0.007 },
  "^CNXIT": { basePrice: 38000, baseVolume: 0, dailyVolatility: 0.009 },
  "^NSEBANK": { basePrice: 51000, baseVolume: 0, dailyVolatility: 0.008 },
};

/** Any symbol not in the known list still gets a stable, plausible profile
 * derived from its own name, so users can add arbitrary tickers in demo
 * mode and still see sensible behavior. */
function profileFor(symbol: string): SymbolProfile {
  const known = KNOWN_PROFILES[symbol];
  if (known) return known;
  const rng = seededRandom(symbol, "profile");
  return {
    basePrice: 200 + rng() * 2800,
    baseVolume: Math.round(500_000 + rng() * 5_000_000),
    dailyVolatility: 0.01 + rng() * 0.01,
  };
}

function walk(symbol: string, days: Date[]): HistoricalBar[] {
  const profile = profileFor(symbol);
  let price = profile.basePrice;
  return days.map((date) => {
    const rng = seededRandom(symbol, dateKey(date), "walk");
    const dailyReturn = seededGaussian(rng) * profile.dailyVolatility;
    price = Math.max(price * (1 + dailyReturn), 0.5);
    const volumeFactor = 0.7 + rng() * 0.6;
    return {
      symbol,
      date,
      close: round2(price),
      volume: profile.baseVolume > 0 ? Math.round(profile.baseVolume * volumeFactor) : null,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class SyntheticMarketDataProvider implements IMarketDataProvider {
  async getHistorical(symbol: string, days: number): Promise<HistoricalBar[]> {
    const tradingDays = lastNTradingDays(new Date(), days);
    return walk(symbol, tradingDays);
  }

  async getObservation(
    symbol: string,
    scenario: DemoScenario = "NORMAL_MARKET",
  ): Promise<RawObservation> {
    if (scenario === "PROVIDER_FAILURE") {
      throw new MarketDataError(`Synthetic provider simulated failure for ${symbol}`, symbol);
    }

    const profile = profileFor(symbol);
    const now = new Date();
    const baseline = await this.getHistorical(symbol, 20);
    const anchorPrice = baseline.at(-1)?.close ?? profile.basePrice;
    const anchorVolume = baseline.at(-1)?.volume ?? profile.baseVolume;

    const rng = seededRandom(symbol, dateKey(now), "today", scenario);
    const normalReturn = seededGaussian(rng) * profile.dailyVolatility;

    let price = anchorPrice * (1 + normalReturn);
    let volume = anchorVolume ? Math.round(anchorVolume * (0.8 + rng() * 0.5)) : null;
    // A real feed can't hand back a trade that hasn't happened yet — when
    // the market is closed, the "current" observation is last close, not
    // this instant, so mimic that instead of fabricating a live timestamp.
    let observedAt = isMarketLikelyOpen(now) ? now : mostRecentMarketClose(now);

    switch (scenario) {
      case "PRICE_SHOCK": {
        const magnitude = 0.07 + rng() * 0.03; // 7–10%
        const sign = rng() < 0.5 ? -1 : 1;
        price = anchorPrice * (1 + sign * magnitude);
        volume = anchorVolume ? Math.round(anchorVolume * (1.3 + rng() * 0.4)) : null;
        break;
      }
      case "VOLUME_SPIKE": {
        const magnitude = 0.003 + rng() * 0.005; // 0.3–0.8%
        const sign = rng() < 0.5 ? -1 : 1;
        price = anchorPrice * (1 + sign * magnitude);
        volume = anchorVolume ? Math.round(anchorVolume * (3.5 + rng() * 1.5)) : null;
        break;
      }
      case "SECTOR_DIVERGENCE": {
        const magnitude = 0.04 + rng() * 0.02; // 4–6%, uncorrelated with benchmark's own walk
        const sign = rng() < 0.5 ? -1 : 1;
        price = anchorPrice * (1 + sign * magnitude);
        volume = anchorVolume ? Math.round(anchorVolume * (0.9 + rng() * 0.3)) : null;
        break;
      }
      case "STALE_DATA": {
        const staleDays = lastNTradingDays(now, 3);
        observedAt = atMarketClose(staleDays[0]);
        break;
      }
      case "NORMAL_MARKET":
      default:
        break;
    }

    return {
      symbol,
      price: round2(price),
      volume,
      observedAt,
      source: "SYNTHETIC",
    };
  }
}
