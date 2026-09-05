import { z } from "zod";

export const addWatchlistItemSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
});

export const commitCheckpointsSchema = z.object({
  items: z
    .array(
      z.object({
        symbol: z.string().min(1),
        observationId: z.string().min(1),
      }),
    )
    .max(200),
});

export const DEMO_SCENARIOS = [
  "NORMAL_MARKET",
  "PRICE_SHOCK",
  "VOLUME_SPIKE",
  "SECTOR_DIVERGENCE",
  "STALE_DATA",
  "PROVIDER_FAILURE",
] as const;

export const setDemoScenarioSchema = z.object({
  symbol: z.string().min(1),
  scenario: z.enum(DEMO_SCENARIOS),
});
