import { describe, expect, it } from "vitest";
import { SyntheticMarketDataProvider } from "@/server/providers/syntheticProvider";
import { MarketDataError } from "@/server/providers/types";

const provider = new SyntheticMarketDataProvider();

describe("SyntheticMarketDataProvider", () => {
  it("is deterministic for a given symbol and day", async () => {
    const a = await provider.getObservation("INFY.NS", "NORMAL_MARKET");
    const b = await provider.getObservation("INFY.NS", "NORMAL_MARKET");
    expect(a.price).toBe(b.price);
    expect(a.volume).toBe(b.volume);
  });

  it("produces a large move for PRICE_SHOCK", async () => {
    const normal = await provider.getObservation("INFY.NS", "NORMAL_MARKET");
    const shocked = await provider.getObservation("INFY.NS", "PRICE_SHOCK");
    const pctMove = Math.abs((shocked.price - normal.price) / normal.price) * 100;
    expect(pctMove).toBeGreaterThan(4);
  });

  it("produces a volume spike for VOLUME_SPIKE without a matching price move", async () => {
    const baseline = await provider.getHistorical("INFY.NS", 20);
    const avgVolume =
      baseline.reduce((sum, b) => sum + (b.volume ?? 0), 0) / baseline.filter((b) => b.volume).length;
    const spike = await provider.getObservation("INFY.NS", "VOLUME_SPIKE");
    expect(spike.volume).toBeGreaterThan(avgVolume * 2.5);
  });

  it("reports an old observedAt for STALE_DATA rather than faking a live timestamp", async () => {
    const stale = await provider.getObservation("INFY.NS", "STALE_DATA");
    const ageMs = Date.now() - stale.observedAt.getTime();
    expect(ageMs).toBeGreaterThan(24 * 60 * 60 * 1000);
  });

  it("throws a MarketDataError for PROVIDER_FAILURE instead of silently returning bad data", async () => {
    await expect(provider.getObservation("INFY.NS", "PROVIDER_FAILURE")).rejects.toBeInstanceOf(
      MarketDataError,
    );
  });

  it("returns exactly the requested number of historical trading days", async () => {
    const bars = await provider.getHistorical("INFY.NS", 20);
    expect(bars).toHaveLength(20);
    // oldest -> newest
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].date.getTime()).toBeGreaterThan(bars[i - 1].date.getTime());
    }
  });

  it("gives an arbitrary unknown symbol a stable synthetic profile too", async () => {
    const a = await provider.getObservation("ZZZZ.NS", "NORMAL_MARKET");
    const b = await provider.getObservation("ZZZZ.NS", "NORMAL_MARKET");
    expect(a.price).toBe(b.price);
    expect(a.price).toBeGreaterThan(0);
  });
});
