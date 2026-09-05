"use client";

import Link from "next/link";
import type { SymbolBriefJSON } from "@/lib/apiTypes";
import { displayNameFor } from "@/lib/displayNames";
import { formatPct, formatPrice } from "@/lib/format";
import { classificationTone, TONE_STYLES } from "@/lib/tone";
import { FreshnessBadge } from "@/components/Badge";

/** One row in the full Watchlist view — every tracked symbol, regardless
 * of classification, at a glance. The "Worth a look" full cards on the
 * Brief page are reserved for what's actually SIGNIFICANT/NOTABLE right
 * now; this is the comprehensive manage-everything list. */
export function WatchlistRow({
  brief,
  onRemove,
}: {
  brief: SymbolBriefJSON;
  onRemove: (symbol: string) => void;
}) {
  const { symbol, observation, unavailableMessage, change } = brief;
  const pct = change?.pctChangeSinceCheckpoint ?? null;
  const tone = classificationTone(change?.classification, pct);
  const name = displayNameFor(symbol);

  let changeLabel: string;
  let changeClass = "text-stone-400";
  if (change?.dataStatus === "NEW") {
    changeLabel = "Just added";
  } else if (pct === 0) {
    changeLabel = "No change";
  } else if (pct !== null) {
    changeLabel = `${formatPct(pct)} since last visit`;
    changeClass = TONE_STYLES[tone].text;
  } else {
    changeLabel = "—";
  }

  return (
    <div
      data-testid={`stock-card-${symbol}`}
      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_STYLES[tone].dot}`} aria-hidden />
        <div className="min-w-0">
          <Link
            href={`/stock/${encodeURIComponent(symbol)}`}
            className="font-mono font-medium text-stone-800 hover:underline"
          >
            {symbol}
          </Link>
          {name && <div className="truncate text-xs text-stone-400">{name}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {unavailableMessage ? (
          <span className="text-xs text-stone-400" title={unavailableMessage}>
            Data unavailable
          </span>
        ) : observation ? (
          <>
            <div className="text-right">
              <div className="tabular-nums text-stone-800">{formatPrice(observation.price)}</div>
              <div className={`text-xs tabular-nums ${changeClass}`}>{changeLabel}</div>
            </div>
            <FreshnessBadge freshness={observation.freshness} />
          </>
        ) : null}
        <button
          onClick={() => onRemove(symbol)}
          aria-label="Remove from watchlist"
          title="Remove from watchlist"
          className="rounded-md px-1 py-0.5 text-stone-300 hover:bg-stone-100 hover:text-stone-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
