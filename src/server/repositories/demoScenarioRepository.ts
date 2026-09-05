import { prisma } from "@/lib/prisma";
import type { DemoScenario } from "@/server/domain/types";

export const demoScenarioRepository = {
  async get(symbol: string): Promise<DemoScenario> {
    const row = await prisma.demoScenarioState.findUnique({ where: { symbol } });
    return (row?.scenario as DemoScenario) ?? "NORMAL_MARKET";
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

  async resetAll(): Promise<void> {
    await prisma.demoScenarioState.deleteMany({});
  },
};
