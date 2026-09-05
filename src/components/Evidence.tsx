import type { ChangeReason, ChangeScoreBreakdown } from "@/lib/apiTypes";
import { benchmarkNameFor } from "@/lib/displayNames";
import { formatPct, formatVolume } from "@/lib/format";
import { movementMultipleOfTypical } from "@/lib/stats";

function Tile({
  label,
  value,
  detail,
  fraction,
  accent = false,
  title,
}: {
  label: string;
  value: string;
  detail?: string | null;
  fraction: number;
  accent?: boolean;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2" title={title}>
      <div className="text-[10px] font-medium tracking-wide text-stone-400 uppercase">{label}</div>
      <div className={`mt-0.5 font-semibold text-stone-800 ${accent ? "text-base" : "text-sm font-medium"}`}>
        {value}
      </div>
      {detail && <div className="text-xs text-stone-500">{detail}</div>}
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-stone-400"
          style={{ width: `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The evidence behind a classification — a compact, data-driven readout of
 * the four scores the Meaningful Change Engine already computes server-side
 * (see changeEngine.ts). Purely presentational: no new scoring logic here.
 *
 * `historicalCloses` and `volume` are optional because they aren't part of
 * the dashboard/brief payload — callers that have them (the stock detail
 * page, or a card that fetched its own historical bars for a sparkline) can
 * pass them through to surface a real, concrete number instead of just a
 * qualitative label. When they're not available, the tiles fall back to the
 * same qualitative reasoning as before — never a fabricated figure.
 */
export function Evidence({
  scores,
  pctChangeSinceCheckpoint,
  benchmarkSymbol,
  reasons,
  historicalCloses = null,
  volume = null,
}: {
  scores: ChangeScoreBreakdown;
  pctChangeSinceCheckpoint: number | null;
  benchmarkSymbol: string | null;
  reasons: ChangeReason[];
  historicalCloses?: number[] | null;
  volume?: number | null;
}) {
  const pctChangePoints = pctChangeSinceCheckpoint !== null ? pctChangeSinceCheckpoint * 100 : null;
  const multiple =
    historicalCloses && pctChangePoints !== null
      ? movementMultipleOfTypical(pctChangePoints, historicalCloses)
      : null;

  const unusualnessValue =
    multiple !== null
      ? multiple < 0.05
        ? "No movement"
        : `${multiple.toFixed(1)}× typical move`
      : reasons.includes("HISTORICAL_CONTEXT_UNAVAILABLE")
        ? "Not enough history"
        : reasons.includes("UNUSUAL_FOR_STOCK")
          ? "Unusual for this stock"
          : "Typical swing";

  const benchmarkName = benchmarkSymbol ? benchmarkNameFor(benchmarkSymbol) : null;
  const divergenceValue = reasons.includes("SECTOR_ALIGNED_MOVE")
    ? "Sector-wide move"
    : reasons.includes("SECTOR_DIVERGENCE")
      ? `Diverging from ${benchmarkName ?? "benchmark"}`
      : benchmarkName
        ? `In line with ${benchmarkName}`
        : "No benchmark available";

  const volumeQualitative = reasons.includes("UNUSUAL_VOLUME") ? "Elevated volume" : "Normal volume";
  const volumeConcrete = volume !== null && volume !== undefined ? formatVolume(volume) : null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tile
        label="Price move"
        value={formatPct(pctChangeSinceCheckpoint)}
        fraction={scores.movementScore}
        accent
        title="Price change since your last checkpoint."
      />
      <Tile
        label="Vs. own history"
        value={unusualnessValue}
        fraction={scores.unusualnessScore}
        accent={multiple !== null}
        title="How this move compares to the stock's own typical day-to-day swing."
      />
      <Tile
        label="Vs. benchmark"
        value={divergenceValue}
        fraction={scores.divergenceScore}
        title="Whether this move tracks or diverges from its sector/market benchmark over the same period."
      />
      <Tile
        label="Volume"
        value={volumeConcrete ?? volumeQualitative}
        detail={volumeConcrete ? volumeQualitative : null}
        fraction={scores.volumeScore}
        accent={volumeConcrete !== null}
        title="Trading volume compared to what's typical for this stock."
      />
    </div>
  );
}
