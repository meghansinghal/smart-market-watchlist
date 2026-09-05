import type { DemoScenario } from "@/server/domain/types";
import { demoScenarioRepository } from "@/server/repositories/demoScenarioRepository";
import { watchlistRepository } from "@/server/repositories/watchlistRepository";

export const demoService = {
  /** Scoped to the requesting user's own watchlist symbols — but the
   * scenario override itself is still global/per-symbol (see setScenario),
   * since it simulates the shared MarketObservation, not anything
   * user-specific. Two users watching the same symbol always see the same
   * forced scenario. */
  async listScenarios(userId: string): Promise<{ symbol: string; scenario: DemoScenario }[]> {
    const watchlist = await watchlistRepository.list(userId);
    const symbols = watchlist.map((w) => w.symbol);
    const scenarios = await demoScenarioRepository.getMany(symbols);
    return symbols.map((symbol) => ({
      symbol,
      scenario: scenarios.get(symbol) ?? "NORMAL_MARKET",
    }));
  },

  async setScenario(symbol: string, scenario: DemoScenario): Promise<void> {
    await demoScenarioRepository.set(symbol, scenario);
  },

  /** Reverts every symbol back to NORMAL_MARKET, i.e. back to whatever the
   * globally configured provider (Yahoo or synthetic) would show. */
  async reset(): Promise<void> {
    await demoScenarioRepository.resetAll();
  },
};
