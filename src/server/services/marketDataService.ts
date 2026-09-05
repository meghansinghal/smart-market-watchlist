import { env } from "@/lib/env";
import { getStaticSnapshot } from "@/server/data/staticSnapshot";
import type {
  DemoScenario,
  Freshness,
  HistoricalBar,
  MarketDataResult,
  MarketObservation,
} from "@/server/domain/types";
import {
  dateKey,
  isMarketLikelyOpen,
  lastNTradingDays,
  mostRecentTradingDay,
} from "@/server/domain/tradingDays";
import { demoScenarioRepository } from "@/server/repositories/demoScenarioRepository";
import { historicalRepository } from "@/server/repositories/historicalRepository";
import { observationRepository } from "@/server/repositories/observationRepository";
import { SyntheticMarketDataProvider } from "@/server/providers/syntheticProvider";
import { MarketDataError, type IMarketDataProvider } from "@/server/providers/types";
import { YahooMarketDataProvider } from "@/server/providers/yahooProvider";

const yahooProvider = new YahooMarketDataProvider(env.marketDataTimeoutMs);
const syntheticProvider = new SyntheticMarketDataProvider();

const LIVE_THRESHOLD_MS = 15 * 60 * 1000;
const DELAYED_THRESHOLD_MS = 6 * 60 * 60 * 1000;

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Freshness depends on both the observation's age AND whether the market
 * is actually open right now — an observation must never be labeled LIVE
 * while the market is closed, no matter how recent its timestamp looks.
 * While the market is closed, CLOSED ("last close") is the expected,
 * healthy state for an observation from the most recent session; STALE is
 * reserved for something older than that (a missed session's worth of
 * updates), so a Friday close doesn't read as broken on Monday morning.
 */
export function classifyFreshness(observedAt: Date, now: Date): Freshness {
  if (isMarketLikelyOpen(now)) {
    const age = now.getTime() - observedAt.getTime();
    if (age <= LIVE_THRESHOLD_MS) return "LIVE";
    if (age <= DELAYED_THRESHOLD_MS) return "DELAYED";
    return "STALE";
  }
  const lastTradingDay = mostRecentTradingDay(now);
  const observedTradingDay = toUtcMidnight(observedAt);
  return observedTradingDay.getTime() >= lastTradingDay.getTime() ? "CLOSED" : "STALE";
}

async function providerFor(symbol: string): Promise<{
  provider: IMarketDataProvider;
  scenario: DemoScenario;
  scenarioUpdatedAt: Date | null;
}> {
  const { scenario, updatedAt } = await demoScenarioRepository.get(symbol);
  const useSynthetic = env.marketDataProvider === "synthetic" || scenario !== "NORMAL_MARKET";
  return { provider: useSynthetic ? syntheticProvider : yahooProvider, scenario, scenarioUpdatedAt: updatedAt };
}

export const marketDataService = {
  /**
   * Fetch the current observation for a symbol, walking the fallback chain
   * (live provider → latest valid cache → bundled static snapshot →
   * unavailable) and never presenting a fallback as live data.
   */
  async fetchObservation(symbol: string): Promise<MarketDataResult> {
    const now = new Date();
    const { provider, scenario, scenarioUpdatedAt } = await providerFor(symbol);

    // While the market is closed, the "current" price for a NORMAL_MARKET
    // symbol can't change until the next session — if we already hold
    // exactly that (this session's close), re-fetching would just ask the
    // provider (burning Yahoo's rate-limit budget in particular) for the
    // same number again. Demo-scenario overrides skip this: they're a
    // deliberate request to regenerate, not organic market data. And even
    // when NORMAL_MARKET is the *current* scenario, the stored observation
    // might predate a reset from an override (e.g. PRICE_SHOCK → back to
    // normal) — reusing it would keep serving the override's price forever
    // until the next session, so only reuse data that was actually
    // received at or after this symbol's scenario last changed.
    if (scenario === "NORMAL_MARKET" && !isMarketLikelyOpen(now)) {
      const stored = await observationRepository.latestFor(symbol);
      const staleRelativeToScenario =
        scenarioUpdatedAt !== null && stored !== null && stored.receivedAt < scenarioUpdatedAt;
      if (stored && !staleRelativeToScenario && classifyFreshness(stored.observedAt, now) === "CLOSED") {
        return { ok: true, observation: { ...stored, freshness: "CLOSED" } };
      }
    }

    try {
      const raw = await provider.getObservation(symbol, scenario);
      const freshness = classifyFreshness(raw.observedAt, now);
      // A demo scenario is an explicit, deliberate override — it must take
      // effect immediately, even if it fabricates an `observedAt` that's
      // "older" than whatever real data happens to be on record. The
      // newest-wins guard in saveIfNewer exists for actual provider
      // out-of-order races, not for this.
      const saved =
        scenario === "NORMAL_MARKET"
          ? await observationRepository.saveIfNewer(raw, freshness)
          : await observationRepository.save(raw, freshness);
      return { ok: true, observation: saved };
    } catch (err) {
      return this.fallback(symbol, err, now);
    }
  },

  async fallback(symbol: string, cause: unknown, now: Date): Promise<MarketDataResult> {
    const reason = cause instanceof MarketDataError ? cause.message : String(cause);

    const cached = await observationRepository.latestFor(symbol);
    if (cached) {
      const relabeled: MarketObservation = { ...cached, freshness: "CACHED", receivedAt: now };
      return { ok: true, observation: relabeled };
    }

    const snapshot = getStaticSnapshot(symbol);
    if (snapshot) {
      const saved = await observationRepository.saveIfNewer(snapshot, "STATIC");
      return { ok: true, observation: { ...saved, freshness: "STATIC" } };
    }

    return {
      ok: false,
      symbol,
      reason: "unavailable",
      message: `No live, cached, or static data available for ${symbol} (${reason})`,
    };
  },

  /**
   * Last `days` completed trading day bars, used as the historical baseline
   * for the Meaningful Change Engine. Falls back to whatever we already
   * have cached in Postgres if the provider call fails; never fabricates
   * bars that were never observed.
   */
  async fetchHistorical(symbol: string, days: number): Promise<HistoricalBar[]> {
    // Completed trading days never change once we have them — if the DB
    // already fully covers the requested range, re-fetching the whole
    // range from the provider on every request is pure waste (and, for
    // Yahoo, burns rate-limit budget for data that can't have moved).
    const wantedDays = lastNTradingDays(new Date(), days);
    const existing = await historicalRepository.getRecent(symbol, days);
    const existingDates = new Set(existing.map((bar) => dateKey(bar.date)));
    const haveFullCoverage =
      existing.length === days && wantedDays.every((d) => existingDates.has(dateKey(d)));
    if (haveFullCoverage) return existing;

    const { provider } = await providerFor(symbol);
    try {
      const bars = await provider.getHistorical(symbol, days);
      if (bars.length > 0) {
        await historicalRepository.upsertMany(bars);
      }
      return bars;
    } catch {
      return existing;
    }
  },
};
