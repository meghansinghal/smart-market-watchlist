"use client";

import useSWR from "swr";
import { apiClient, ApiError } from "@/lib/apiClient";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { timeOfDayGreeting } from "@/lib/greeting";
import { formatRelativeTime } from "@/lib/format";
import { useCommitCheckpoints } from "@/lib/useCommitCheckpoints";
import { StockCard } from "@/components/StockCard";

export default function BriefPage() {
  const { userId, userName } = useCurrentUser();

  const {
    data: dashboard,
    error: dashboardError,
    isLoading,
    mutate: refetchDashboard,
  } = useSWR(userId ? ["dashboard", userId] : null, () => apiClient.getDashboard(userId!));

  useCommitCheckpoints(dashboard, userId);

  // Purely decorative — fetched via SWR (not a raw useState+useEffect) so
  // the browser's local time is only ever read after mount, never during
  // server rendering, which would otherwise risk a hydration mismatch.
  const { data: greeting } = useSWR("greeting", () => timeOfDayGreeting());

  async function handleRemove(symbol: string) {
    if (!userId) return;
    await refetchDashboard(
      apiClient.removeWatchlistItem(userId, symbol).then(() => apiClient.getDashboard(userId)),
      {
        optimisticData: (prev) => ({ ...prev!, items: prev!.items.filter((i) => i.symbol !== symbol) }),
      },
    );
  }

  const error = dashboardError instanceof ApiError ? dashboardError.message : dashboardError ? "Couldn't load your watchlist." : null;

  const worthALook = dashboard?.items.filter(
    (i) => i.change?.classification === "SIGNIFICANT" || i.change?.classification === "NOTABLE",
  ) ?? [];
  const noChangeCount = (dashboard?.items.length ?? 0) - worthALook.length;
  // Sort significant first so the biggest deal is always at the top.
  const sortedWorthALook = [...worthALook].sort((a, b) => {
    const rank = (c?: string | null) => (c === "SIGNIFICANT" ? 0 : 1);
    return rank(a.change?.classification) - rank(b.change?.classification);
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          {greeting ?? "Hello"}
          {userName ? `, ${userName}` : ""}
        </h1>
        {dashboard && (
          <span
            className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              dashboard.marketOpen
                ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                : "bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${dashboard.marketOpen ? "bg-green-500" : "bg-stone-400"}`}
            />
            Market {dashboard.marketOpen ? "open" : "closed"}
          </span>
        )}
      </header>

      {isLoading && <p className="text-sm text-stone-500">Loading your brief…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {dashboard && (
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium tracking-wide text-stone-400 uppercase">
              Since your last visit
            </div>
            <div className="text-xs text-stone-400">{formatRelativeTime(dashboard.generatedAt)}</div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div
              className={`flex items-baseline gap-2 rounded-xl px-3 py-1.5 ${
                worthALook.length > 0 ? "bg-amber-50" : ""
              }`}
            >
              <span
                className={`font-mono text-4xl font-bold tabular-nums ${
                  worthALook.length > 0 ? "text-amber-700" : "text-stone-300"
                }`}
              >
                {worthALook.length}
              </span>
              <span className="text-sm font-medium text-stone-600">
                meaningful change{worthALook.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="pb-1.5 text-xs text-stone-400">
              {noChangeCount} no meaningful change{noChangeCount === 1 ? "" : "s"}
            </div>
          </div>
        </section>
      )}

      {dashboard && dashboard.items.length === 0 && !isLoading && (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          Your watchlist is empty.{" "}
          <a href="/watchlist" className="underline">
            Add a symbol
          </a>{" "}
          to start tracking it.
        </p>
      )}

      {dashboard && sortedWorthALook.length === 0 && dashboard.items.length > 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          Nothing worth a look right now — everything&apos;s within its normal range.
        </p>
      )}

      {sortedWorthALook.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Worth a look</h2>
          {sortedWorthALook.map((item) => (
            <StockCard key={item.symbol} brief={item} onRemove={handleRemove} />
          ))}
        </section>
      )}
    </div>
  );
}
