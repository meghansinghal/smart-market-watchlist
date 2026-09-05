"use client";

import Link from "next/link";
import type { SymbolBriefJSON } from "@/lib/apiTypes";
import { displayNameFor } from "@/lib/displayNames";
import { formatObservationTimestamp, formatPct, formatPrice } from "@/lib/format";
import { ClassificationBadge, FreshnessBadge } from "@/components/Badge";
import { Evidence } from "@/components/Evidence";

/** The full-detail "worth a look" card — reserved for SIGNIFICANT/NOTABLE
 * stocks. Normal/unchanged stocks use CompactStockRow instead, so
 * attention is spent where something actually happened. */
export function StockCard({
  brief,
  onRemove,
}: {
  brief: SymbolBriefJSON;
  onRemove: (symbol: string) => void;
}) {
  const { symbol, observation, change, explanation } = brief;
  const pct = change?.pctChangeSinceCheckpoint ?? null;
  const name = displayNameFor(symbol);
  const previousPrice = change?.previousCheckpoint?.price ?? null;
  // buildReasons() orders reasons by priority, so the first bullet is the
  // primary driver of the classification — a single "why this matters"
  // line, rather than repeating the full reasons list already covered by
  // the evidence tiles below.
  const whyThisMatters = explanation?.bullets[0] ?? explanation?.headline ?? null;

  return (
    <div
      data-testid={`stock-card-${symbol}`}
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/stock/${encodeURIComponent(symbol)}`}
              className="font-mono font-semibold text-stone-900 hover:underline"
            >
              {symbol}
            </Link>
            {change?.classification && <ClassificationBadge classification={change.classification} />}
          </div>
          {name && <div className="text-xs text-stone-400">{name}</div>}
          {observation && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {previousPrice !== null ? (
                <span className="text-stone-400">{formatPrice(previousPrice)} →</span>
              ) : null}
              <span className="text-lg font-semibold text-stone-900">{formatPrice(observation.price)}</span>
              <span
                className={
                  pct !== null && pct > 0
                    ? "font-medium text-green-700"
                    : pct !== null && pct < 0
                      ? "font-medium text-red-700"
                      : "text-stone-500"
                }
              >
                {pct === 0 ? "No change" : formatPct(pct)}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(symbol)}
          aria-label="Remove from watchlist"
          title="Remove from watchlist"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-sm text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          ✕
        </button>
      </div>

      {whyThisMatters && (
        <div className="mt-3">
          <div className="text-[10px] font-medium tracking-wide text-stone-400 uppercase">
            Why this matters
          </div>
          <p className="mt-0.5 text-sm text-stone-700">{whyThisMatters}</p>
        </div>
      )}

      {change?.scores && (
        <div className="mt-3">
          <Evidence
            scores={change.scores}
            pctChangeSinceCheckpoint={pct}
            benchmarkSymbol={change.benchmarkSymbol}
            reasons={change.reasons}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2">
        <Link href={`/stock/${encodeURIComponent(symbol)}`} className="text-xs text-stone-500 hover:underline">
          View details →
        </Link>
        {observation && (
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <FreshnessBadge freshness={observation.freshness} />
            <span>{formatObservationTimestamp(observation.observedAt, observation.freshness)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
