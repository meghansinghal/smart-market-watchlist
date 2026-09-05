"use client";

import Link from "next/link";
import useSWR from "swr";
import type { SymbolBriefJSON } from "@/lib/apiTypes";
import { apiClient } from "@/lib/apiClient";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { displayNameFor } from "@/lib/displayNames";
import { formatObservationTimestamp, formatPct, formatPrice } from "@/lib/format";
import { classificationTone, TONE_BORDER, TONE_SOFT_BG, TONE_TEXT } from "@/lib/tone";
import { ClassificationBadge, FreshnessBadge } from "@/components/Badge";
import { Evidence } from "@/components/Evidence";
import { PriceChart } from "@/components/PriceChart";

/** The full-detail "worth a look" card — reserved for SIGNIFICANT/NOTABLE
 * stocks. Normal/unchanged stocks use WatchlistRow instead, so attention is
 * spent where something actually happened. */
export function StockCard({
  brief,
  onRemove,
}: {
  brief: SymbolBriefJSON;
  onRemove: (symbol: string) => void;
}) {
  const { symbol, observation, change, explanation } = brief;
  const pct = change?.pctChangeSinceCheckpoint ?? null;
  const classification = change?.classification ?? null;
  const tone = classificationTone(classification, pct);
  const name = displayNameFor(symbol);
  const previousPrice = change?.previousCheckpoint?.price ?? null;
  // buildReasons() orders reasons by priority, so the first bullet is the
  // primary driver of the classification — a single "why this matters"
  // line, rather than repeating the full reasons list already covered by
  // the evidence tiles below.
  const whyThisMatters = explanation?.bullets[0] ?? explanation?.headline ?? null;

  const { userId } = useCurrentUser();
  // Only fetch historical bars for a symbol worth showing a sparkline for —
  // the dashboard payload this card was built from doesn't include them,
  // so this reuses the existing per-stock endpoint (same one the detail
  // page uses, and the same SWR key, so the cache is shared) rather than
  // changing the dashboard API to carry more data than it needs to.
  const showChart = classification === "SIGNIFICANT" || classification === "NOTABLE";
  const { data: detail } = useSWR(
    showChart && userId ? ["stock", symbol, userId] : null,
    () => apiClient.getStock(userId!, symbol),
  );

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
            {classification && <ClassificationBadge classification={classification} pct={pct} />}
          </div>
          {name && <div className="text-xs text-stone-400">{name}</div>}
          {observation && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {previousPrice !== null ? (
                <span className="text-stone-400">{formatPrice(previousPrice)} →</span>
              ) : null}
              <span className="text-lg font-semibold text-stone-900">{formatPrice(observation.price)}</span>
              <span className={pct === 0 || pct === null ? "text-stone-500" : `font-medium ${TONE_TEXT[tone]}`}>
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

      {showChart && detail && detail.historicalBars.length > 0 && (
        <div className="mt-2">
          <PriceChart
            bars={detail.historicalBars}
            current={
              detail.observation ? { date: detail.observation.observedAt, price: detail.observation.price } : null
            }
            tone={tone}
            compact
          />
        </div>
      )}

      {whyThisMatters && (
        <div className={`mt-3 rounded-lg border-l-4 py-2 pl-3 pr-2 ${TONE_BORDER[tone]} ${TONE_SOFT_BG[tone]}`}>
          <div className={`text-[10px] font-semibold tracking-wide uppercase ${TONE_TEXT[tone]}`}>
            Why this matters
          </div>
          <p className="mt-0.5 text-sm font-medium text-stone-800">{whyThisMatters}</p>
        </div>
      )}

      {change?.scores && (
        <div className="mt-3">
          <Evidence
            scores={change.scores}
            pctChangeSinceCheckpoint={pct}
            benchmarkSymbol={change.benchmarkSymbol}
            reasons={change.reasons}
            historicalCloses={detail?.historicalBars.map((b) => b.close) ?? null}
            volume={observation?.volume ?? null}
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
