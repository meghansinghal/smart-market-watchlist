import { getStaticSnapshot } from "@/server/data/staticSnapshot";
import type {
  DemoScenario,
  Freshness,
  HistoricalBar,
  MarketDataResult,
  MarketObservation,
  ObservationSource,
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
 *
 * It also depends on `source`: synthetic data is generated to look like
 * the latest available price, never a genuine real-time tick, so it must
 * never be classified LIVE/DELAYED regardless of how recent its own
 * timestamp is — those two states are reserved for a real provider (see
 * IMarketDataProvider) that isn't wired up yet. Falling through to the
 * same day-comparison logic used whenever the market itself is shut still
 * correctly distinguishes "today's" data from stale older data, without
 * ever implying it's live.
 */
export function classifyFreshness(observedAt: Date, now: Date, source: ObservationSource): Freshness {
  if (isMarketLikelyOpen(now) && source !== "SYNTHETIC") {
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
  // Only the synthetic provider is wired up for now (see the
  // "final architecture decisions" this app is deployed under — no
  // dependency on any external market-data API). A real provider would
  // plug in here, behind the same IMarketDataProvider interface, without
  // touching fetchObservation/fetchHistorical below.
  return { provider: syntheticProvider, scenario, scenarioUpdatedAt: updatedAt };
}

export const marketDataService = {
  /**
   * Fetch the current observation for a symbol, walking the fallback chain
   * (provider → latest valid cache → bundled static snapshot → unavailable)
   * and never presenting a fallback as live data.
   */
  async fetchObservation(symbol: string): Promise<MarketDataResult> {
    const now = new Date();
    // Known, accepted race: scenario is read once here and not re-checked
    // before the eventual save below. If a concurrent request resets the
    // scenario in between, this write's `receivedAt` lands *after* that
    // reset's `scenarioUpdatedAt`, so a later request's staleness check
    // (below) would wrongly treat this stale-scenario data as current. This
    // needs two near-simultaneous requests racing on the exact same symbol
    // to matter — re-checking the scenario immediately before every save
    // would close it, but adds a retry path for a window this unlikely at
    // this app's actual (mostly single-user-driven) traffic. Documented as
    // a deliberate tradeoff rather than left as an unexamined gap.
    const { provider, scenario, scenarioUpdatedAt } = await providerFor(symbol);

    // While the market is closed, the "current" price for a NORMAL_MARKET
    // symbol can't change until the next session — if we already hold
    // exactly that (this session's close), re-fetching would just ask the
    // provider for the same number again. Demo-scenario overrides skip
    // this: they're a deliberate request to regenerate, not organic market
    // data. And even when NORMAL_MARKET is the *current* scenario, the
    // stored observation might predate a reset from an override (e.g.
    // PRICE_SHOCK → back to normal) — reusing it would keep serving the
    // override's price forever until the next session, so only reuse data
    // that was actually received at or after this symbol's scenario last
    // changed.
    if (scenario === "NORMAL_MARKET" && !isMarketLikelyOpen(now)) {
      const stored = await observationRepository.latestFor(symbol);
      const staleRelativeToScenario =
        scenarioUpdatedAt !== null && stored !== null && stored.receivedAt < scenarioUpdatedAt;
      if (
        stored &&
        !staleRelativeToScenario &&
        classifyFreshness(stored.observedAt, now, stored.source) === "CLOSED"
      ) {
        return { ok: true, observation: { ...stored, freshness: "CLOSED" } };
      }
    }

    try {
      const raw = await provider.getObservation(symbol, scenario);
      const freshness = classifyFreshness(raw.observedAt, now, raw.source);
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
    // range from the provider on every request is pure waste.
    const wantedDays = lastNTradingDays(new Date(), days);
    const existing = await historicalRepository.getRecent(symbol, days);
    const existingDates = new Set(existing.map((bar) => dateKey(bar.date)));
    const haveFullCoverage =
      existing.length === days && wantedDays.every((d) => existingDates.has(dateKey(d)));
    if (haveFullCoverage) return existing;

    // Unlike fetchObservation, this doesn't go through providerFor: historical
    // bars are always the plain deterministic walk regardless of any active
    // demo scenario (getHistorical has no scenario parameter), so looking up
    // the scenario here would just be a wasted lookup on every call.
    try {
      const bars = await syntheticProvider.getHistorical(symbol, days);
      if (bars.length > 0) {
        await historicalRepository.upsertMany(bars);
      }
      return bars;
    } catch {
      return existing;
    }
  },
};
