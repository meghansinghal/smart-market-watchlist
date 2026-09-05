import type { DemoScenario } from "@/server/domain/types";
import { demoScenarioRepository } from "@/server/repositories/demoScenarioRepository";
import { watchlistRepository } from "@/server/repositories/watchlistRepository";

export const demoService = {
  async listScenarios(): Promise<{ symbol: string; scenario: DemoScenario }[]> {
    const watchlist = await watchlistRepository.list();
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
