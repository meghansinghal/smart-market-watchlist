"use client";

import Link from "next/link";
import type { DemoScenario, SymbolBriefJSON } from "@/lib/apiTypes";
import { formatObservationTimestamp, formatPct, formatPrice } from "@/lib/format";
import { ClassificationBadge, FreshnessBadge } from "@/components/Badge";
import { DemoScenarioMenu } from "@/components/DemoScenarioMenu";

export function StockCard({
  brief,
  demoScenario,
  onRemove,
  onDemoChanged,
}: {
  brief: SymbolBriefJSON;
  demoScenario: DemoScenario;
  onRemove: (symbol: string) => void;
  onDemoChanged: () => void;
}) {
  const { symbol, observation, unavailableMessage, change, explanation } = brief;

  return (
    <div
      data-testid={`stock-card-${symbol}`}
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/stock/${encodeURIComponent(symbol)}`} className="font-semibold hover:underline">
            {symbol}
          </Link>
          {observation && (
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
              <span className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {formatPrice(observation.price)}
              </span>
              {change?.pctChangeSinceCheckpoint !== undefined && change?.pctChangeSinceCheckpoint !== null && (
                <span
                  className={
                    change.pctChangeSinceCheckpoint > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : change.pctChangeSinceCheckpoint < 0
                        ? "text-red-600 dark:text-red-400"
                        : ""
                  }
                >
                  {formatPct(change.pctChangeSinceCheckpoint)}
                </span>
              )}
              <FreshnessBadge freshness={observation.freshness} />
              <span className="text-xs text-zinc-400">
                {formatObservationTimestamp(observation.observedAt, observation.freshness)}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {change?.classification && <ClassificationBadge classification={change.classification} />}
          <button
            onClick={() => onRemove(symbol)}
            aria-label="Remove from watchlist"
            title="Remove from watchlist"
            className="rounded-md px-1.5 py-0.5 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
      </div>

      {unavailableMessage ? (
        <p className="mt-3 text-sm text-zinc-500">{unavailableMessage}</p>
      ) : explanation ? (
        <div className="mt-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{explanation.headline}</p>
          {explanation.bullets.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-zinc-500">
              {explanation.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <Link href={`/stock/${encodeURIComponent(symbol)}`} className="text-xs text-zinc-500 hover:underline">
          View details →
        </Link>
        <DemoScenarioMenu symbol={symbol} current={demoScenario} onChanged={onDemoChanged} />
      </div>
    </div>
  );
}
