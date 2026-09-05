import type { ChangeReason, ChangeResult } from "@/server/domain/types";

function pct(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

function reasonText(reason: ChangeReason, result: ChangeResult): string | null {
  const pctStr = result.pctChangeSinceCheckpoint !== null ? pct(result.pctChangeSinceCheckpoint) : null;
  switch (reason) {
    case "LARGE_PRICE_MOVE":
      return `Price moved ${pctStr} since your last visit — a large move in absolute terms.`;
    case "UNUSUAL_FOR_STOCK":
      return `This move is unusually large compared with ${result.symbol}'s typical day-to-day swings.`;
    case "SECTOR_DIVERGENCE":
      return `${result.symbol} moved very differently from ${result.benchmarkSymbol}, its benchmark.`;
    case "UNUSUAL_VOLUME":
      return `Trading volume was well above its recent average.`;
    case "SECTOR_ALIGNED_MOVE":
      return `Price moved ${pctStr}, but the broader benchmark (${result.benchmarkSymbol}) moved similarly — this looks like a sector-wide move rather than something stock-specific.`;
    case "LIMITED_PRICE_MOVEMENT":
      return `The price itself barely moved, so this isn't a meaningful price change on its own.`;
    case "HISTORICAL_CONTEXT_UNAVAILABLE":
      return `Not enough historical data was available to fully assess how unusual this move is.`;
    case "FIRST_OBSERVATION":
      return `This is the first time we've checked ${result.symbol} — we'll compare against this baseline next time you visit.`;
    case "STALE_DATA":
      return `The latest data we have for ${result.symbol} looks out of date, so we're not scoring it as a meaningful change right now.`;
    case "DATA_UNAVAILABLE":
      return `We couldn't retrieve data for ${result.symbol}.`;
    default:
      return null;
  }
}

export interface Explanation {
  headline: string;
  bullets: string[];
}

/** Turns a ChangeResult into deterministic, human-readable copy. No LLM,
 * no randomness — same input always produces the same explanation, which
 * matters for trust in a finance product. */
export function explain(result: ChangeResult): Explanation {
  const bullets = result.reasons
    .map((r) => reasonText(r, result))
    .filter((t): t is string => t !== null);

  let headline: string;
  if (result.dataStatus === "NEW") {
    headline = `Now tracking ${result.symbol}.`;
  } else if (result.dataStatus === "LIMITED") {
    headline = `${result.symbol} data may be out of date.`;
  } else if (result.classification === "SIGNIFICANT") {
    headline = `${result.symbol} changed significantly since your last visit.`;
  } else if (result.classification === "NOTABLE") {
    headline = `${result.symbol} is worth a look.`;
  } else {
    headline = `Nothing meaningful changed for ${result.symbol}.`;
  }

  return { headline, bullets };
}

export function formatPct(n: number | null, digits = 1): string {
  if (n === null) return "—";
  return pct(n, digits);
}
