import { benchmarkFor } from "@/server/domain/sectors";
import type { ChangeResult, HistoricalBar, MarketObservation } from "@/server/domain/types";
import { checkpointRepository } from "@/server/repositories/checkpointRepository";
import { watchlistRepository } from "@/server/repositories/watchlistRepository";
import { computeChange } from "@/server/services/changeEngine";
import { marketDataService } from "@/server/services/marketDataService";

const BASELINE_DAYS = 20;

function averageVolume(bars: HistoricalBar[]): number | null {
  const volumes = bars.map((b) => b.volume).filter((v): v is number => v !== null);
  if (volumes.length === 0) return null;
  return volumes.reduce((a, b) => a + b, 0) / volumes.length;
}

/** Closest historical bar at or before `date`; falls back to the oldest
 * available bar if `date` predates our whole history window rather than
 * fabricating a number. */
function closestBarOnOrBefore(bars: HistoricalBar[], date: Date): HistoricalBar | null {
  if (bars.length === 0) return null;
  let best: HistoricalBar | null = null;
  for (const bar of bars) {
    if (bar.date.getTime() <= date.getTime()) {
      if (!best || bar.date.getTime() > best.date.getTime()) best = bar;
    }
  }
  return best ?? bars[0];
}

export interface SymbolBrief {
  symbol: string;
  observation: MarketObservation | null;
  unavailableMessage: string | null;
  change: ChangeResult | null;
}

const benchmarkCache = new Map<
  string,
  Promise<{ observation: MarketObservation | null; bars: HistoricalBar[] }>
>();

async function getBenchmarkData(benchmarkSymbol: string) {
  const cached = benchmarkCache.get(benchmarkSymbol);
  if (cached) return cached;
  const promise = (async () => {
    const [result, bars] = await Promise.all([
      marketDataService.fetchObservation(benchmarkSymbol),
      marketDataService.fetchHistorical(benchmarkSymbol, BASELINE_DAYS),
    ]);
    return { observation: result.ok ? result.observation : null, bars };
  })();
  benchmarkCache.set(benchmarkSymbol, promise);
  return promise;
}

/**
 * Market data (observation, historical bars) is fetched exactly the same
 * way regardless of which user is asking — it's shared/global, per the
 * product design. Only the checkpoint comparison below is user-scoped, so
 * two users watching the same symbol share one underlying fetch/cache but
 * always see their own personal "what changed" result.
 */
async function buildSymbolBrief(userId: string, symbol: string): Promise<SymbolBrief> {
  const [obsResult, checkpoint, historicalBars] = await Promise.all([
    marketDataService.fetchObservation(symbol),
    checkpointRepository.get(userId, symbol),
    marketDataService.fetchHistorical(symbol, BASELINE_DAYS),
  ]);

  if (!obsResult.ok) {
    return { symbol, observation: null, unavailableMessage: obsResult.message, change: null };
  }

  const benchmarkSymbol = benchmarkFor(symbol);
  let benchmarkPctChangePoints: number | null = null;

  if (checkpoint) {
    const benchmark = await getBenchmarkData(benchmarkSymbol);
    const anchorBar = closestBarOnOrBefore(benchmark.bars, checkpoint.observedAt);
    if (benchmark.observation && anchorBar && anchorBar.close > 0) {
      benchmarkPctChangePoints =
        ((benchmark.observation.price - anchorBar.close) / anchorBar.close) * 100;
    }
  }

  const change = computeChange({
    symbol,
    current: obsResult.observation,
    checkpoint,
    historicalCloses: historicalBars.map((b) => b.close),
    averageHistoricalVolume: averageVolume(historicalBars),
    benchmarkPctChangePoints,
    benchmarkSymbol,
  });

  return { symbol, observation: obsResult.observation, unavailableMessage: null, change };
}

export interface DashboardBrief {
  generatedAt: Date;
  items: SymbolBrief[];
}

export const marketBriefService = {
  async getSymbolBrief(userId: string, symbol: string): Promise<SymbolBrief> {
    return buildSymbolBrief(userId, symbol);
  },

  async getDashboardBrief(userId: string): Promise<DashboardBrief> {
    benchmarkCache.clear();
    const watchlist = await watchlistRepository.list(userId);
    const items = await Promise.all(watchlist.map((w) => buildSymbolBrief(userId, w.symbol)));
    return { generatedAt: new Date(), items };
  },
};
