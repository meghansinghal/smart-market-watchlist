import { prisma } from "@/lib/prisma";
import type { DemoScenario } from "@/server/domain/types";

export interface DemoScenarioStateInfo {
  scenario: DemoScenario;
  /** When this symbol's scenario last changed — null if it's never been
   * touched (has always been NORMAL_MARKET). Lets callers tell "cached
   * data from before the last scenario change" apart from "cached data
   * that already reflects it". */
  updatedAt: Date | null;
}

export const demoScenarioRepository = {
  async get(symbol: string): Promise<DemoScenarioStateInfo> {
    const row = await prisma.demoScenarioState.findUnique({ where: { symbol } });
    return {
      scenario: (row?.scenario as DemoScenario) ?? "NORMAL_MARKET",
      updatedAt: row?.updatedAt ?? null,
    };
  },

  async getMany(symbols: string[]): Promise<Map<string, DemoScenario>> {
    if (symbols.length === 0) return new Map();
    const rows = await prisma.demoScenarioState.findMany({ where: { symbol: { in: symbols } } });
    return new Map(rows.map((r) => [r.symbol, r.scenario as DemoScenario]));
  },

  async set(symbol: string, scenario: DemoScenario): Promise<void> {
    await prisma.demoScenarioState.upsert({
      where: { symbol },
      create: { symbol, scenario },
      update: { scenario },
    });
  },

  /** Resets every symbol back to NORMAL_MARKET by updating existing rows
   * in place (bumping `updatedAt`) rather than deleting them — deleting
   * would erase the "when did this last change" signal that the Market
   * Data Service's closed-market cache-reuse check relies on to avoid
   * serving stale scenario-tainted data after a reset. */
  async resetAll(): Promise<void> {
    await prisma.demoScenarioState.updateMany({ data: { scenario: "NORMAL_MARKET" } });
  },
};
