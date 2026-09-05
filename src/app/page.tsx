"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { apiClient, ApiError } from "@/lib/apiClient";
import { formatRelativeTime } from "@/lib/format";
import { AddSymbolForm } from "@/components/AddSymbolForm";
import { StockCard } from "@/components/StockCard";

export default function Home() {
  const {
    data: dashboard,
    error: dashboardError,
    isLoading,
    mutate: refetchDashboard,
  } = useSWR("dashboard", apiClient.getDashboard);
  const { data: scenariosData, mutate: refetchScenarios } = useSWR(
    "demo-scenarios",
    apiClient.getDemoScenarios,
  );
  const scenarios = new Map((scenariosData?.scenarios ?? []).map((s) => [s.symbol, s.scenario]));

  const committedGeneratedAt = useRef<string | null>(null);

  // Once the dashboard has actually been rendered with a fresh brief, tell
  // the server "the user has now seen this" so next visit's comparison
  // baseline moves forward. Guarded so a given brief is only acknowledged
  // once, even across dev double-effects or re-fetches of the same data.
  useEffect(() => {
    if (!dashboard || committedGeneratedAt.current === dashboard.generatedAt) return;
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
      apiClient.commitCheckpoints(items).catch(() => {
        // Best-effort acknowledgement; next load will retry naturally.
      });
    }
  }, [dashboard]);

  function refetchAll() {
    refetchDashboard();
    refetchScenarios();
  }

  async function handleRemove(symbol: string) {
    // Only reachable once a StockCard is rendered, i.e. dashboard is loaded.
    await refetchDashboard(apiClient.removeWatchlistItem(symbol).then(() => apiClient.getDashboard()), {
      optimisticData: (prev) => ({ ...prev!, items: prev!.items.filter((i) => i.symbol !== symbol) }),
    });
  }

  async function handleResetDemo() {
    await apiClient.resetDemo();
    refetchAll();
  }

  const error = dashboardError instanceof ApiError ? dashboardError.message : dashboardError ? "Couldn't load your watchlist." : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">What Did I Miss?</h1>
        <p className="text-sm text-zinc-500">
          Your watchlist, filtered down to what actually changed since you last looked.
        </p>
      </header>

      <AddSymbolForm onAdded={refetchAll} />

      {dashboard && (
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>
            Updated {formatRelativeTime(dashboard.generatedAt)} · Market{" "}
            {dashboard.marketOpen ? "open" : "closed"}
          </span>
          <button onClick={handleResetDemo} className="hover:text-zinc-600 dark:hover:text-zinc-300">
            Reset demo scenarios
          </button>
        </div>
      )}

      {isLoading && <p className="text-sm text-zinc-500">Loading your watchlist…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {dashboard && dashboard.items.length === 0 && !isLoading && (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Your watchlist is empty. Add a symbol above to start tracking it.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {dashboard?.items.map((item) => (
          <StockCard
            key={item.symbol}
            brief={item}
            demoScenario={scenarios.get(item.symbol) ?? "NORMAL_MARKET"}
            onRemove={handleRemove}
            onDemoChanged={refetchAll}
          />
        ))}
      </div>
    </div>
  );
}
