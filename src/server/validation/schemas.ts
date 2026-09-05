import { z } from "zod";

// Not an auth token — just the id of the demo user the request is acting
// as (see User Switcher). Required on every endpoint that reads or writes
// per-user state (watchlist, checkpoints).
export const userIdSchema = z.string().min(1);

export const addWatchlistItemSchema = z.object({
  userId: userIdSchema,
  symbol: z.string().trim().min(1).max(20),
});

export const commitCheckpointsSchema = z.object({
  userId: userIdSchema,
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
