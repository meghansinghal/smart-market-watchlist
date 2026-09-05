/**
 * A tiny concurrency gate: at most `max` calls to `run` execute at once;
 * anything beyond that queues (FIFO) until a slot frees up. Used to keep
 * the Yahoo provider from firing a burst of simultaneous requests — e.g. a
 * watchlist of several symbols each needing a quote plus a chart, all
 * kicked off via Promise.all — which is far more likely to trip Yahoo's
 * rate limiting than the same requests spread out.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: (() => void)[] = [];

  constructor(private readonly max: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}
