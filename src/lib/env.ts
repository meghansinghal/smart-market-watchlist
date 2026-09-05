export type ProviderMode = "yahoo" | "synthetic";

export const env = {
  marketDataProvider: (process.env.MARKET_DATA_PROVIDER === "yahoo"
    ? "yahoo"
    : "synthetic") as ProviderMode,
  marketDataTimeoutMs: Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 5000),
};
