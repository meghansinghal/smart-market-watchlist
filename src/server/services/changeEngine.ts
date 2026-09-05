import type {
  ChangeClassification,
  ChangeReason,
  ChangeResult,
  ChangeScoreBreakdown,
  Checkpoint,
  DataStatus,
  MarketObservation,
} from "@/server/domain/types";

const WEIGHTS = {
  movement: 0.35,
  unusualness: 0.3,
  divergence: 0.2,
  volume: 0.15,
};

const THRESHOLDS = {
  notable: 0.3,
  significant: 0.55,
};

// Guardrail tuning. These are deliberately explicit rather than "learned"
// so the engine stays deterministic and explainable.
const MOVEMENT_SATURATION_PCT = 8; // |move| at/above this saturates MovementScore
const UNUSUALNESS_Z_SATURATION = 4; // z-score at/above this saturates UnusualnessScore
const DIVERGENCE_SATURATION_PCT = 6; // |divergence| pp at/above this saturates DivergenceScore
const VOLUME_RATIO_SATURATION = 3; // volume / avgVolume at/above this saturates VolumeScore
const MIN_HISTORICAL_DAYS = 5; // below this, don't trust stdev-based stats
const STALE_AGE_MS = 24 * 60 * 60 * 1000; // beyond this, don't score normally

const LARGE_MOVE_GUARDRAIL_PCT = 5;
const TINY_MOVE_GUARDRAIL_PCT = 0.5;
const SECTOR_ALIGNED_DIVERGENCE_SCORE = 0.25;
const HIGH_VOLUME_FLOOR_SCORE = 0.5;
const HIGH_VOLUME_FLOOR_MAX_MOVE_PCT = 2;
const UNUSUAL_FOR_STOCK_THRESHOLD = 0.6;
const SECTOR_DIVERGENCE_THRESHOLD = 0.5;
const UNUSUAL_VOLUME_THRESHOLD = 0.5;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function movementScore(pctChangePoints: number): number {
  return clamp01(Math.abs(pctChangePoints) / MOVEMENT_SATURATION_PCT);
}

/** Standard deviation (population) of day-over-day % returns, in
 * percentage points, computed from a series of closes oldest→newest.
 *
 * Mirrored client-side in src/lib/stats.ts — the dashboard/stock-detail
 * payload only carries `historicalCloses`, not this derived stat, so the
 * UI recomputes the same formula from that raw data to show a real
 * "×typical move" figure rather than inventing one. Keep both in sync if
 * this formula ever changes. */
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

// Below this, a stock's historical volatility is so close to zero that
// dividing by it would make any nonzero move look infinitely "unusual" —
// an artifact of the statistics, not a real signal. Treat it the same as
// not having a reliable baseline at all, rather than fabricating a score.
const DEGENERATE_STDEV_PCT = 0.15;

export function unusualnessScore(pctChangePoints: number, stdevPct: number | null): number {
  if (stdevPct === null || stdevPct < DEGENERATE_STDEV_PCT) return 0;
  const z = Math.abs(pctChangePoints) / stdevPct;
  return clamp01(z / UNUSUALNESS_Z_SATURATION);
}

export function divergenceScore(
  pctChangePoints: number,
  benchmarkPctChangePoints: number | null,
): number {
  if (benchmarkPctChangePoints === null) return 0;
  const divergence = Math.abs(pctChangePoints - benchmarkPctChangePoints);
  return clamp01(divergence / DIVERGENCE_SATURATION_PCT);
}

export function volumeScore(currentVolume: number | null, averageVolume: number | null): number {
  if (currentVolume === null || averageVolume === null || averageVolume <= 0) return 0;
  const ratio = currentVolume / averageVolume;
  return clamp01((ratio - 1) / (VOLUME_RATIO_SATURATION - 1));
}

export function attentionScore(scores: Omit<ChangeScoreBreakdown, "attentionScore">): number {
  return (
    WEIGHTS.movement * scores.movementScore +
    WEIGHTS.unusualness * scores.unusualnessScore +
    WEIGHTS.divergence * scores.divergenceScore +
    WEIGHTS.volume * scores.volumeScore
  );
}

/**
 * Whether an observation is trustworthy enough to score/checkpoint normally.
 * Shared by the change engine (deciding whether to classify) and the
 * Checkpoint Service (deciding whether it's safe to update "what the user
 * last saw" from this observation).
 */
export function assessDataStatus(
  observation: Pick<MarketObservation, "freshness" | "observedAt">,
  now: Date,
): DataStatus {
  if (
    observation.freshness === "STALE" ||
    observation.freshness === "STATIC" ||
    observation.freshness === "UNAVAILABLE"
  ) {
    return "LIMITED";
  }
  // CACHED carries no inherent recency guarantee on its own (it's simply
  // whatever we last managed to store), so it gets an age backstop. LIVE,
  // DELAYED and CLOSED are already correctly bounded relative to market
  // state by the Market Data Service's freshness classification — applying
  // this same age check to them would, e.g., wrongly flag a perfectly
  // legitimate Friday close as "limited" by Monday morning.
  if (observation.freshness === "CACHED") {
    const ageMs = now.getTime() - observation.observedAt.getTime();
    if (ageMs > STALE_AGE_MS) return "LIMITED";
  }
  return "OK";
}

export function baseClassification(score: number): ChangeClassification {
  if (score >= THRESHOLDS.significant) return "SIGNIFICANT";
  if (score >= THRESHOLDS.notable) return "NOTABLE";
  return "NORMAL";
}

export interface GuardrailInput {
  attentionScoreValue: number;
  pctChangePoints: number;
  scores: ChangeScoreBreakdown;
  hasBenchmark: boolean;
}

export interface GuardrailResult {
  classification: ChangeClassification;
  sectorAligned: boolean;
}

/**
 * Applies the product guardrails on top of the raw weighted score. Order
 * matters: the volume floor only nudges NORMAL→NOTABLE, the large-move
 * override can promote to SIGNIFICANT (unless the move is sector-aligned,
 * in which case it's capped at NOTABLE instead), and the tiny-move cap has
 * final say so volume/unusualness alone can never manufacture a
 * SIGNIFICANT classification out of a negligible price move.
 */
export function applyGuardrails(input: GuardrailInput): GuardrailResult {
  const absMove = Math.abs(input.pctChangePoints);
  let classification = baseClassification(input.attentionScoreValue);

  if (classification === "NORMAL" && input.scores.volumeScore >= HIGH_VOLUME_FLOOR_SCORE && absMove < HIGH_VOLUME_FLOOR_MAX_MOVE_PCT) {
    classification = "NOTABLE";
  }

  const sectorAligned =
    input.hasBenchmark && input.scores.divergenceScore < SECTOR_ALIGNED_DIVERGENCE_SCORE;

  if (absMove >= LARGE_MOVE_GUARDRAIL_PCT) {
    classification = sectorAligned ? "NOTABLE" : "SIGNIFICANT";
  }

  if (absMove < TINY_MOVE_GUARDRAIL_PCT && classification === "SIGNIFICANT") {
    classification = "NOTABLE";
  }

  return { classification, sectorAligned };
}

export function buildReasons(args: {
  pctChangePoints: number;
  scores: ChangeScoreBreakdown;
  sectorAligned: boolean;
  hasBenchmark: boolean;
  historicalDaysUsed: number;
}): ChangeReason[] {
  const absMove = Math.abs(args.pctChangePoints);
  const reasons: ChangeReason[] = [];

  if (absMove >= LARGE_MOVE_GUARDRAIL_PCT) {
    reasons.push(args.sectorAligned ? "SECTOR_ALIGNED_MOVE" : "LARGE_PRICE_MOVE");
  }
  if (args.scores.unusualnessScore >= UNUSUAL_FOR_STOCK_THRESHOLD) {
    reasons.push("UNUSUAL_FOR_STOCK");
  }
  if (!args.sectorAligned && args.scores.divergenceScore >= SECTOR_DIVERGENCE_THRESHOLD) {
    reasons.push("SECTOR_DIVERGENCE");
  }
  if (args.scores.volumeScore >= UNUSUAL_VOLUME_THRESHOLD) {
    reasons.push("UNUSUAL_VOLUME");
  }
  if (absMove < TINY_MOVE_GUARDRAIL_PCT) {
    reasons.push("LIMITED_PRICE_MOVEMENT");
  }
  if (args.historicalDaysUsed < MIN_HISTORICAL_DAYS || !args.hasBenchmark) {
    reasons.push("HISTORICAL_CONTEXT_UNAVAILABLE");
  }

  return reasons;
}

export interface ComputeChangeInput {
  symbol: string;
  current: MarketObservation;
  checkpoint: Checkpoint | null;
  historicalCloses: number[]; // oldest -> newest
  averageHistoricalVolume: number | null;
  benchmarkPctChangePoints: number | null;
  benchmarkSymbol: string;
  now?: Date;
}

/**
 * Pure decision core of the Meaningful Change Engine. Takes already-fetched
 * inputs (no I/O) so it's trivially unit-testable and so callers control
 * exactly what "current", "checkpoint" and "historical" mean.
 */
export function computeChange(input: ComputeChangeInput): ChangeResult {
  const now = input.now ?? new Date();
  const historicalDaysUsed = input.historicalCloses.length;

  const shared = {
    symbol: input.symbol,
    currentObservation: input.current,
    benchmarkSymbol: input.benchmarkSymbol,
    historicalDaysUsed,
  };

  if (!input.checkpoint) {
    return {
      ...shared,
      dataStatus: "NEW",
      classification: null,
      scores: null,
      reasons: ["FIRST_OBSERVATION"],
      pctChangeSinceCheckpoint: null,
      previousCheckpoint: null,
    };
  }

  const pctChangeSinceCheckpoint =
    (input.current.price - input.checkpoint.price) / input.checkpoint.price;
  const pctChangePoints = pctChangeSinceCheckpoint * 100;

  const dataStatus = assessDataStatus(input.current, now);

  if (dataStatus === "LIMITED") {
    return {
      ...shared,
      dataStatus,
      classification: null,
      scores: null,
      reasons: ["STALE_DATA"],
      pctChangeSinceCheckpoint,
      previousCheckpoint: input.checkpoint,
    };
  }

  const hasSufficientHistory = historicalDaysUsed >= MIN_HISTORICAL_DAYS;
  const stdev = hasSufficientHistory ? dailyReturnStdevPct(input.historicalCloses) : null;
  const hasBenchmark = input.benchmarkPctChangePoints !== null;

  const scores: ChangeScoreBreakdown = {
    movementScore: movementScore(pctChangePoints),
    unusualnessScore: hasSufficientHistory ? unusualnessScore(pctChangePoints, stdev) : 0,
    divergenceScore: divergenceScore(pctChangePoints, input.benchmarkPctChangePoints),
    volumeScore: volumeScore(input.current.volume, input.averageHistoricalVolume),
    attentionScore: 0,
  };
  scores.attentionScore = attentionScore(scores);

  const { classification, sectorAligned } = applyGuardrails({
    attentionScoreValue: scores.attentionScore,
    pctChangePoints,
    scores,
    hasBenchmark,
  });

  const reasons = buildReasons({
    pctChangePoints,
    scores,
    sectorAligned,
    hasBenchmark,
    historicalDaysUsed,
  });

  return {
    ...shared,
    dataStatus: "OK",
    classification,
    scores,
    reasons,
    pctChangeSinceCheckpoint,
    previousCheckpoint: input.checkpoint,
  };
}
