"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import useSWR from "swr";
import type { DataStatus } from "@/lib/apiTypes";
import { apiClient, ApiError } from "@/lib/apiClient";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { benchmarkNameFor, displayNameFor, sectorLabelFor } from "@/lib/displayNames";
import { formatDate, formatObservationTimestamp, formatPct, formatPrice, formatVolume } from "@/lib/format";
import { classificationTone, TONE_CALLOUT, TONE_TEXT, type Tone } from "@/lib/tone";
import { ClassificationBadge, FreshnessBadge } from "@/components/Badge";
import { Evidence } from "@/components/Evidence";
import { PriceChart } from "@/components/PriceChart";

// A stale/limited data status is a caution regardless of what the last
// good classification was, so it overrides the usual tone.
function calloutTone(tone: Tone, dataStatus: DataStatus | undefined): string {
  if (dataStatus === "LIMITED") return TONE_CALLOUT.amber;
  return TONE_CALLOUT[tone];
}

export default function StockDetailPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = decodeURIComponent(params.symbol);
  const { userId } = useCurrentUser();

  const {
    data: detail,
    error: fetchError,
    isLoading,
  } = useSWR(userId ? ["stock", symbol, userId] : null, () => apiClient.getStock(userId!, symbol));
  const error = fetchError instanceof ApiError ? fetchError.message : fetchError ? "Couldn't load this stock." : null;
  const committedObservationId = useRef<string | null>(null);
  const pct = detail?.change?.pctChangeSinceCheckpoint ?? null;
  const tone = classificationTone(detail?.change?.classification, pct);
  const name = displayNameFor(symbol);
  const sector = sectorLabelFor(symbol);

  useEffect(() => {
    const observationId = detail?.observation?.id;
    const dataStatus = detail?.change?.dataStatus;
    if (!detail || !userId || !observationId || (dataStatus !== "OK" && dataStatus !== "NEW")) return;
    if (committedObservationId.current === observationId) return;
    committedObservationId.current = observationId;
    apiClient.commitCheckpoints(userId, [{ symbol: detail.symbol, observationId }]).catch(() => {});
  }, [detail, userId]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <Link href="/watchlist" className="w-fit text-sm text-stone-500 hover:underline">
        ← Back to watchlist
      </Link>

      {isLoading && <p className="text-sm text-stone-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {detail && (
        <>
          <header className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-stone-900">{detail.symbol}</h1>
              {detail.change?.classification && (
                <ClassificationBadge classification={detail.change.classification} pct={pct} />
              )}
            </div>
            {(name || sector) && (
              <p className="text-sm text-stone-400">{[name, sector].filter(Boolean).join(" · ")}</p>
            )}
            {detail.observation && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
                <span className="text-xl font-semibold text-stone-900">
                  {formatPrice(detail.observation.price)}
                </span>
                {pct !== null && (
                  <span className={pct === 0 ? "text-stone-500" : `font-medium ${TONE_TEXT[tone]}`}>
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

          <section>
            <PriceChart
              bars={detail.historicalBars}
              current={detail.observation ? { date: detail.observation.observedAt, price: detail.observation.price } : null}
              checkpoint={
                detail.change?.previousCheckpoint
                  ? { date: detail.change.previousCheckpoint.observedAt, price: detail.change.previousCheckpoint.price }
                  : null
              }
              tone={tone}
            />
            <p className="mt-1 text-xs text-stone-400">
              Last {detail.historicalBars.length} trading days · benchmark {benchmarkNameFor(detail.benchmarkSymbol)}
            </p>
          </section>

          {detail.explanation && (
            <div className={`rounded-xl border p-4 ${calloutTone(tone, detail.change?.dataStatus)}`}>
              <p className="text-base font-semibold text-stone-900">{detail.explanation.headline}</p>
              {detail.explanation.bullets.length > 0 && !detail.change?.scores && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-stone-600">
                  {detail.explanation.bullets.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              )}
              {detail.change?.scores && (
                <div className="mt-3">
                  <Evidence
                    scores={detail.change.scores}
                    pctChangeSinceCheckpoint={pct}
                    benchmarkSymbol={detail.change.benchmarkSymbol}
                    reasons={detail.change.reasons}
                    historicalCloses={detail.historicalBars.map((b) => b.close)}
                    volume={detail.observation?.volume ?? null}
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

          <p className="text-xs text-stone-400">Informational only. Not investment advice.</p>
        </>
      )}
    </div>
  );
}
