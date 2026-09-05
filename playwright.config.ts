import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // This app has no multi-tenancy — one shared watchlist/checkpoint/demo
  // state for the whole instance (see prisma/schema.prisma). Parallel
  // workers mutating that shared state race each other, so tests run
  // serially against the single dev server instead.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { MARKET_DATA_PROVIDER: "synthetic" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
