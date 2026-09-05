"use client";

import useSWR from "swr";
import { apiClient, ApiError } from "@/lib/apiClient";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { useCommitCheckpoints } from "@/lib/useCommitCheckpoints";
import { AddSymbolForm } from "@/components/AddSymbolForm";
import { WatchlistRow } from "@/components/WatchlistRow";

export default function WatchlistPage() {
  const { userId } = useCurrentUser();

  const {
    data: dashboard,
    error: dashboardError,
    isLoading,
    mutate: refetchDashboard,
  } = useSWR(userId ? ["dashboard", userId] : null, () => apiClient.getDashboard(userId!));

  useCommitCheckpoints(dashboard, userId);

  function refetchAll() {
    refetchDashboard();
  }

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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Watchlist</h1>
      </header>

      {userId && <AddSymbolForm userId={userId} onAdded={refetchAll} />}

      {isLoading && <p className="text-sm text-stone-500">Loading your watchlist…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {dashboard && dashboard.items.length === 0 && !isLoading && (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          Your watchlist is empty. Add a symbol above to start tracking it.
        </p>
      )}

      {dashboard && dashboard.items.length > 0 && (
        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
          {dashboard.items.map((item) => (
            <WatchlistRow key={item.symbol} brief={item} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
