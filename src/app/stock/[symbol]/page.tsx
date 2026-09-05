"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import useSWR from "swr";
import { apiClient, ApiError } from "@/lib/apiClient";
import { formatDate, formatObservationTimestamp, formatPct, formatPrice, formatVolume } from "@/lib/format";
import { ClassificationBadge, FreshnessBadge } from "@/components/Badge";
import { PriceChart } from "@/components/PriceChart";

export default function StockDetailPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = decodeURIComponent(params.symbol);

  const {
    data: detail,
    error: fetchError,
    isLoading,
  } = useSWR(["stock", symbol], () => apiClient.getStock(symbol));
  const error = fetchError instanceof ApiError ? fetchError.message : fetchError ? "Couldn't load this stock." : null;
  const committedObservationId = useRef<string | null>(null);

  useEffect(() => {
    const observationId = detail?.observation?.id;
    const dataStatus = detail?.change?.dataStatus;
    if (!detail || !observationId || (dataStatus !== "OK" && dataStatus !== "NEW")) return;
    if (committedObservationId.current === observationId) return;
    committedObservationId.current = observationId;
    apiClient.commitCheckpoints([{ symbol: detail.symbol, observationId }]).catch(() => {});
  }, [detail]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <Link href="/" className="w-fit text-sm text-zinc-500 hover:underline">
        ← Back to watchlist
      </Link>

      {isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {detail && (
        <>
          <header className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{detail.symbol}</h1>
              {detail.change?.classification && (
                <ClassificationBadge classification={detail.change.classification} />
              )}
            </div>
            {detail.observation && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <span className="text-xl font-medium text-zinc-900 dark:text-zinc-100">
                  {formatPrice(detail.observation.price)}
                </span>
                {detail.change?.pctChangeSinceCheckpoint !== null &&
                  detail.change?.pctChangeSinceCheckpoint !== undefined && (
                    <span
                      className={
                        detail.change.pctChangeSinceCheckpoint > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : detail.change.pctChangeSinceCheckpoint < 0
                            ? "text-red-600 dark:text-red-400"
                            : ""
                      }
                    >
                      {formatPct(detail.change.pctChangeSinceCheckpoint)} since last visit
                    </span>
                  )}
                <FreshnessBadge freshness={detail.observation.freshness} />
                <span>
                  {formatObservationTimestamp(detail.observation.observedAt, detail.observation.freshness)}
                </span>
              </div>
            )}
          </header>

          {detail.unavailableMessage && (
            <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              {detail.unavailableMessage}
            </p>
          )}

          {detail.explanation && (
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="font-medium">{detail.explanation.headline}</p>
              {detail.explanation.bullets.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-600 dark:text-zinc-400">
                  {detail.explanation.bullets.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {detail.change?.previousCheckpoint && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="text-xs text-zinc-400">Last checkpoint</div>
                <div className="mt-1 font-medium">{formatPrice(detail.change.previousCheckpoint.price)}</div>
                <div className="text-xs text-zinc-500">
                  {formatDate(detail.change.previousCheckpoint.observedAt)} · vol{" "}
                  {formatVolume(detail.change.previousCheckpoint.volume)}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="text-xs text-zinc-400">Now</div>
                <div className="mt-1 font-medium">
                  {detail.observation ? formatPrice(detail.observation.price) : "—"}
                </div>
                <div className="text-xs text-zinc-500">
                  vol {detail.observation ? formatVolume(detail.observation.volume) : "—"}
                </div>
              </div>
            </div>
          )}

          <section>
            <h2 className="mb-2 text-sm font-medium text-zinc-500">
              Last {detail.historicalBars.length} trading days
            </h2>
            <PriceChart bars={detail.historicalBars} />
            <p className="mt-1 text-xs text-zinc-400">Benchmark: {detail.benchmarkSymbol}</p>
          </section>
        </>
      )}
    </div>
  );
}
