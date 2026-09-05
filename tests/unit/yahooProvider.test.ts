import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chartMock = vi.fn();
const quoteMock = vi.fn();

vi.mock("yahoo-finance2", () => ({
  default: class {
    chart = chartMock;
    quote = quoteMock;
  },
}));

const { YahooMarketDataProvider } = await import("@/server/providers/yahooProvider");
const { MarketDataError } = await import("@/server/providers/types");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("YahooMarketDataProvider.getHistorical", () => {
  it("caps period2 at today's UTC midnight so today's still-forming bar is never included", async () => {
    // A real symptom of not doing this: Yahoo returns an (N+1)th bar for
    // "today", silently violating the "last N *completed* trading days,
    // never including today" contract documented on lastNTradingDays.
    chartMock.mockResolvedValueOnce({ quotes: [] });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:51:00.000Z"));

    const provider = new YahooMarketDataProvider(5000);
    await provider.getHistorical("INFY.NS", 20);

    expect(chartMock).toHaveBeenCalledOnce();
    const options = chartMock.mock.calls[0][1];
    expect(options.period2.toISOString()).toBe("2026-09-04T00:00:00.000Z");
  });

  it("maps quotes to HistoricalBar, dropping any without a numeric close", async () => {
    chartMock.mockResolvedValueOnce({
      quotes: [
        { date: new Date("2026-09-02T03:45:00Z"), close: 1140, volume: 8564358 },
        { date: new Date("2026-09-03T03:45:00Z"), close: null, volume: 100 },
      ],
    });
    const provider = new YahooMarketDataProvider(5000);
    const bars = await provider.getHistorical("INFY.NS", 20);
    expect(bars).toEqual([
      { symbol: "INFY.NS", date: new Date("2026-09-02T03:45:00Z"), close: 1140, volume: 8564358 },
    ]);
  });
});

describe("YahooMarketDataProvider.getObservation", () => {
  it("maps a Yahoo quote to a RawObservation using regularMarketTime", async () => {
    quoteMock.mockResolvedValueOnce({
      regularMarketPrice: 1130,
      regularMarketVolume: 5880888,
      regularMarketTime: new Date("2026-09-04T09:45:00Z"),
    });
    const provider = new YahooMarketDataProvider(5000);
    const obs = await provider.getObservation("INFY.NS");
    expect(obs).toEqual({
      symbol: "INFY.NS",
      price: 1130,
      volume: 5880888,
      observedAt: new Date("2026-09-04T09:45:00Z"),
      source: "YAHOO",
    });
  });

  it("throws a MarketDataError when Yahoo returns no usable price", async () => {
    quoteMock.mockResolvedValueOnce({ regularMarketPrice: undefined });
    const provider = new YahooMarketDataProvider(5000);
    await expect(provider.getObservation("INFY.NS")).rejects.toBeInstanceOf(MarketDataError);
  });
});
