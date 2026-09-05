"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import useSWR from "swr";
import { apiClient, ApiError } from "@/lib/apiClient";
import { formatDate, formatObservationTimestamp, formatPct, formatPrice, formatVolume } from "@/lib/format";
import { ClassificationBadge, FreshnessBadge } from "@/components/Badge";
import { Evidence } from "@/components/Evidence";
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
  const pct = detail?.change?.pctChangeSinceCheckpoint ?? null;

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
      <Link href="/" className="w-fit text-sm text-stone-500 hover:underline">
        ← Back to watchlist
      </Link>

      {isLoading && <p className="text-sm text-stone-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {detail && (
        <>
          <header className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">{detail.symbol}</h1>
              {detail.change?.classification && (
                <ClassificationBadge classification={detail.change.classification} />
              )}
            </div>
            {detail.observation && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
                <span className="text-xl font-semibold text-stone-900">
                  {formatPrice(detail.observation.price)}
                </span>
                {pct !== null && (
                  <span className={pct > 0 ? "text-green-700" : pct < 0 ? "text-red-700" : "text-stone-500"}>
                    {pct === 0 ? "No change" : formatPct(pct)} since last visit
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
            <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-600">{detail.unavailableMessage}</p>
          )}

          {detail.explanation && (
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="font-medium text-stone-800">{detail.explanation.headline}</p>
              {detail.change?.scores && (
                <div className="mt-3">
                  <Evidence
                    scores={detail.change.scores}
                    pctChangeSinceCheckpoint={pct}
                    benchmarkSymbol={detail.change.benchmarkSymbol}
                    reasons={detail.change.reasons}
                  />
                </div>
              )}
            </div>
          )}

          {detail.change?.previousCheckpoint && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-xs text-stone-400">Last checkpoint</div>
                <div className="mt-1 font-medium text-stone-800">
                  {formatPrice(detail.change.previousCheckpoint.price)}
                </div>
                <div className="text-xs text-stone-500">
                  {formatDate(detail.change.previousCheckpoint.observedAt)} · vol{" "}
                  {formatVolume(detail.change.previousCheckpoint.volume)}
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-xs text-stone-400">Now</div>
                <div className="mt-1 font-medium text-stone-800">
                  {detail.observation ? formatPrice(detail.observation.price) : "—"}
                </div>
                <div className="text-xs text-stone-500">
                  vol {detail.observation ? formatVolume(detail.observation.volume) : "—"}
                </div>
              </div>
            </div>
          )}

          <section>
            <h2 className="mb-2 text-sm font-medium text-stone-500">
              Last {detail.historicalBars.length} trading days
            </h2>
            <PriceChart bars={detail.historicalBars} />
            <p className="mt-1 text-xs text-stone-400">Benchmark: {detail.benchmarkSymbol}</p>
          </section>
        </>
      )}
    </div>
  );
}
