"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { apiClient, ApiError } from "@/lib/apiClient";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { formatRelativeTime } from "@/lib/format";
import { AddSymbolForm } from "@/components/AddSymbolForm";
import { StockCard } from "@/components/StockCard";
import { CompactStockRow } from "@/components/CompactStockRow";
import { MarketSimulationPanel } from "@/components/MarketSimulationPanel";
import { UserSwitcher } from "@/components/UserSwitcher";

export default function Home() {
  const { userId, setUserId } = useCurrentUser();
  // CurrentUserProvider already defaults userId to the first seeded user
  // once the list loads — this fetch just supplies the switcher's options
  // (SWR dedupes it against the context's own "users" fetch).
  const { data: usersData } = useSWR("users", apiClient.getUsers);
  const users = usersData?.users ?? [];

  // Every user-scoped fetch is keyed by userId, so switching users is just
  // a normal SWR cache-key change — it refetches and re-renders that
  // user's watchlist and "since your last visit" state immediately.
  const {
    data: dashboard,
    error: dashboardError,
    isLoading,
    mutate: refetchDashboard,
  } = useSWR(userId ? ["dashboard", userId] : null, () => apiClient.getDashboard(userId!));
  const { data: scenariosData, mutate: refetchScenarios } = useSWR(
    userId ? ["demo-scenarios", userId] : null,
    () => apiClient.getDemoScenarios(userId!),
  );
  const scenarios = new Map((scenariosData?.scenarios ?? []).map((s) => [s.symbol, s.scenario]));

  const committedGeneratedAt = useRef<string | null>(null);

  // Once the dashboard has actually been rendered with a fresh brief, tell
  // the server "this user has now seen this" so next visit's comparison
  // baseline moves forward. Guarded so a given brief is only acknowledged
  // once, even across dev double-effects or re-fetches of the same data.
  useEffect(() => {
    if (!dashboard || !userId || committedGeneratedAt.current === dashboard.generatedAt) return;
    committedGeneratedAt.current = dashboard.generatedAt;
    // "OK" means we compared against a prior checkpoint; "NEW" means this
    // symbol has none yet. Both are checkpoint-worthy — NEW is exactly how
    // a freshly added symbol gets its first baseline established.
    const items = dashboard.items
      .filter(
        (item) =>
          (item.change?.dataStatus === "OK" || item.change?.dataStatus === "NEW") && item.observation,
      )
      .map((item) => ({ symbol: item.symbol, observationId: item.observation!.id }));
    if (items.length > 0) {
      apiClient.commitCheckpoints(userId, items).catch(() => {
        // Best-effort acknowledgement; next load will retry naturally.
      });
    }
  }, [dashboard, userId]);

  function refetchAll() {
    refetchDashboard();
    refetchScenarios();
  }

  async function handleRemove(symbol: string) {
    if (!userId) return;
    // Only reachable once a card/row is rendered, i.e. dashboard is loaded.
    await refetchDashboard(
      apiClient.removeWatchlistItem(userId, symbol).then(() => apiClient.getDashboard(userId)),
      {
        optimisticData: (prev) => ({ ...prev!, items: prev!.items.filter((i) => i.symbol !== symbol) }),
      },
    );
  }

  async function handleResetSimulation() {
    await apiClient.resetDemo();
    refetchAll();
  }

  const error = dashboardError instanceof ApiError ? dashboardError.message : dashboardError ? "Couldn't load your watchlist." : null;

  const worthALook = dashboard?.items.filter(
    (i) => i.change?.classification === "SIGNIFICANT" || i.change?.classification === "NOTABLE",
  ) ?? [];
  const significantCount = worthALook.filter((i) => i.change?.classification === "SIGNIFICANT").length;
  const notableCount = worthALook.length - significantCount;
  // Sort significant first so the biggest deal is always at the top.
  const sortedWorthALook = [...worthALook].sort((a, b) => {
    const rank = (c?: string | null) => (c === "SIGNIFICANT" ? 0 : 1);
    return rank(a.change?.classification) - rank(b.change?.classification);
  });
  const everythingElse = dashboard?.items.filter((i) => !worthALook.includes(i)) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">What Did I Miss?</h1>
          <p className="mt-1 text-sm text-stone-500">
            Your watchlist, filtered down to what actually changed since you last looked.
          </p>
        </div>
        <div className="mt-1 flex shrink-0 flex-col items-end gap-2">
          <UserSwitcher users={users} currentUserId={userId} onChange={setUserId} />
          {dashboard && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
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
        </div>
      </header>

      {isLoading && <p className="text-sm text-stone-500">Loading your watchlist…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {dashboard && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium tracking-wide text-stone-400 uppercase">
            Since your last visit
          </div>
          {worthALook.length === 0 ? (
            <p className="mt-1 text-lg font-semibold text-stone-800">
              Nothing significant changed — you&apos;re all caught up.
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold text-stone-800">
              {worthALook.length} stock{worthALook.length === 1 ? "" : "s"} worth a look
              <span className="ml-2 text-sm font-normal text-stone-500">
                {[
                  significantCount > 0 ? `${significantCount} significant` : null,
                  notableCount > 0 ? `${notableCount} notable` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </p>
          )}
          <p className="mt-1 text-xs text-stone-400">Updated {formatRelativeTime(dashboard.generatedAt)}</p>
        </section>
      )}

      {dashboard && dashboard.items.length === 0 && !isLoading && (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          Your watchlist is empty. Add a symbol below to start tracking it.
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

      {everythingElse.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            No meaningful change
          </h2>
          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
            {everythingElse.map((item) => (
              <CompactStockRow key={item.symbol} brief={item} onRemove={handleRemove} />
            ))}
          </div>
        </section>
      )}

      {userId && <AddSymbolForm userId={userId} onAdded={refetchAll} />}

      {dashboard && (
        <MarketSimulationPanel
          symbols={dashboard.items.map((i) => i.symbol)}
          scenarios={scenarios}
          onReset={handleResetSimulation}
          onChanged={refetchAll}
        />
      )}
    </div>
  );
}
