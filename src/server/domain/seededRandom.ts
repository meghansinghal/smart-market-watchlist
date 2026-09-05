/** Deterministic PRNG utilities so synthetic market data is reproducible:
 * same symbol + same calendar day always yields the same numbers. This is
 * what makes the synthetic provider safe for tests and stable demos. */

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good-enough-for-demo-data PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A PRNG seeded from an arbitrary set of string/number parts. Reordering
 * or changing any part changes the whole sequence. */
export function seededRandom(...parts: (string | number)[]): () => number {
  const seed = hashString(parts.join("::"));
  return mulberry32(seed);
}

/** Standard normal sample via Box-Muller, driven by a seeded PRNG. */
export function seededGaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
