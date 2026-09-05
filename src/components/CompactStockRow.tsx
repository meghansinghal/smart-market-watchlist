"use client";

import Link from "next/link";
import type { SymbolBriefJSON } from "@/lib/apiTypes";
import { formatPct, formatPrice } from "@/lib/format";
import { FreshnessBadge } from "@/components/Badge";

/** A dense single-line row for stocks with nothing worth flagging — the
 * product's whole point is to filter attention, so these get a fraction of
 * the visual weight a "worth a look" StockCard gets. */
export function CompactStockRow({
  brief,
  onRemove,
}: {
  brief: SymbolBriefJSON;
  onRemove: (symbol: string) => void;
}) {
  const { symbol, observation, unavailableMessage, change } = brief;
  const pct = change?.pctChangeSinceCheckpoint ?? null;

  let changeLabel: string;
  let changeClass = "text-stone-400";
  if (change?.dataStatus === "NEW") {
    changeLabel = "Just added";
  } else if (pct === 0) {
    changeLabel = "No change";
  } else if (pct !== null) {
    changeLabel = formatPct(pct);
    changeClass = pct > 0 ? "text-green-700" : "text-red-700";
  } else {
    changeLabel = "—";
  }

  return (
    <div
      data-testid={`stock-card-${symbol}`}
      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
    >
      <Link
        href={`/stock/${encodeURIComponent(symbol)}`}
        className="min-w-0 truncate font-medium text-stone-700 hover:underline"
      >
        {symbol}
      </Link>
      <div className="flex shrink-0 items-center gap-3">
        {unavailableMessage ? (
          <span className="text-xs text-stone-400" title={unavailableMessage}>
            Data unavailable
          </span>
        ) : observation ? (
          <>
            <span className="tabular-nums text-stone-600">{formatPrice(observation.price)}</span>
            <span className={`w-20 text-right tabular-nums ${changeClass}`}>{changeLabel}</span>
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
