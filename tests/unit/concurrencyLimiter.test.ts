import { describe, expect, it } from "vitest";
import { ConcurrencyLimiter } from "@/server/providers/concurrencyLimiter";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("ConcurrencyLimiter", () => {
  it("never runs more than `max` tasks at once", async () => {
    const limiter = new ConcurrencyLimiter(2);
    let active = 0;
    let maxObserved = 0;
    const gates = Array.from({ length: 5 }, () => deferred<void>());

    const runs = gates.map((gate, i) =>
      limiter.run(async () => {
        active++;
        maxObserved = Math.max(maxObserved, active);
        await gate.promise;
        active--;
        return i;
      }),
    );

    // Let the first batch actually start before releasing anything.
    await new Promise((r) => setTimeout(r, 10));
    expect(maxObserved).toBe(2);

    gates.forEach((g) => g.resolve());
    const results = await Promise.all(runs);
    expect(results).toEqual([0, 1, 2, 3, 4]);
  });

  it("propagates a task's rejection without blocking the queue", async () => {
    const limiter = new ConcurrencyLimiter(1);
    const first = limiter.run(async () => {
      throw new Error("boom");
    });
    const second = limiter.run(async () => "ok");

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
  });

  it("returns each task's own result", async () => {
    const limiter = new ConcurrencyLimiter(3);
    const results = await Promise.all([1, 2, 3].map((n) => limiter.run(async () => n * 10)));
    expect(results).toEqual([10, 20, 30]);
  });
});
