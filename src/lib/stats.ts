// Mirrors the Meaningful Change Engine's own daily-return-stdev formula
// (src/server/services/changeEngine.ts) so the client can derive the same
// real statistic — "how many times bigger is this move than a typical
// day's" — from historical closes the API already returns, without ever
// guessing a number that isn't backed by actual data.

const DEGENERATE_STDEV_PCT = 0.15;

/** Standard deviation (population) of day-over-day % returns, in
 * percentage points, computed from a series of closes oldest→newest. */
export function dailyReturnStdevPct(closes: number[]): number | null {
  if (closes.length < 2) return null;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    if (prev === 0) continue;
    returns.push(((closes[i] - prev) / prev) * 100);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

/** How many multiples of a typical day's move the given change represents.
 * `null` when there isn't a reliable baseline to compare against — never a
 * fabricated ratio. */
export function movementMultipleOfTypical(pctChangePoints: number, closes: number[]): number | null {
  const stdev = dailyReturnStdevPct(closes);
  if (stdev === null || stdev < DEGENERATE_STDEV_PCT) return null;
  return Math.abs(pctChangePoints) / stdev;
}
