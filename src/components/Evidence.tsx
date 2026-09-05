import type { ChangeReason, ChangeScoreBreakdown } from "@/lib/apiTypes";
import { formatPct } from "@/lib/format";

function Tile({ label, value, fraction }: { label: string; value: string; fraction: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="text-[10px] font-medium tracking-wide text-stone-400 uppercase">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-stone-800">{value}</div>
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
 */
export function Evidence({
  scores,
  pctChangeSinceCheckpoint,
  benchmarkSymbol,
  reasons,
}: {
  scores: ChangeScoreBreakdown;
  pctChangeSinceCheckpoint: number | null;
  benchmarkSymbol: string | null;
  reasons: ChangeReason[];
}) {
  const unusualnessValue = reasons.includes("HISTORICAL_CONTEXT_UNAVAILABLE")
    ? "Not enough history"
    : reasons.includes("UNUSUAL_FOR_STOCK")
      ? "Unusual for this stock"
      : "Typical swing";

  const divergenceValue = reasons.includes("SECTOR_ALIGNED_MOVE")
    ? "Sector-wide move"
    : reasons.includes("SECTOR_DIVERGENCE")
      ? `Diverging from ${benchmarkSymbol ?? "benchmark"}`
      : benchmarkSymbol
        ? `In line with ${benchmarkSymbol}`
        : "No benchmark available";

  const volumeValue = reasons.includes("UNUSUAL_VOLUME") ? "Elevated volume" : "Normal volume";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tile label="Price move" value={formatPct(pctChangeSinceCheckpoint)} fraction={scores.movementScore} />
      <Tile label="Vs. own history" value={unusualnessValue} fraction={scores.unusualnessScore} />
      <Tile label="Vs. benchmark" value={divergenceValue} fraction={scores.divergenceScore} />
      <Tile label="Volume" value={volumeValue} fraction={scores.volumeScore} />
    </div>
  );
}
