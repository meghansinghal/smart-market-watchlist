"use client";

import useSWR, { useSWRConfig } from "swr";
import { apiClient } from "@/lib/apiClient";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { ScenarioSelect } from "@/components/ScenarioSelect";

/**
 * Market Simulation — a secondary, always-accessible capability (opened
 * from the sidebar, on every page) for testing and exploring how the
 * market brief responds to different market conditions, not a
 * presenter-only demo mode. Forcing a scenario here only changes what the
 * synthetic provider generates for that symbol; the resulting observation
 * still flows through the same persistence, Meaningful Change Engine, and
 * explanation pipeline as any other market data — the classification you
 * see afterward is always derived from the resulting numbers, never
 * assigned directly.
 */
export function MarketSimulationModal({ onClose }: { onClose: () => void }) {
  const { userId } = useCurrentUser();
  const { mutate } = useSWRConfig();
  const { data: scenariosData } = useSWR(
    userId ? ["demo-scenarios", userId] : null,
    () => apiClient.getDemoScenarios(userId!),
  );
  const scenarios = new Map((scenariosData?.scenarios ?? []).map((s) => [s.symbol, s.scenario]));

  function refetchAll() {
    mutate(["demo-scenarios", userId]);
    mutate(["dashboard", userId]);
  }

  async function handleReset() {
    await apiClient.resetDemo();
    refetchAll();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-stone-800 uppercase">Market simulation</h2>
            <p className="mt-1 text-xs text-stone-500">
              Preview how the market brief responds to different market conditions — useful for
              testing and exploring the change engine, not just for presentations.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md px-1.5 py-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3">
          <div className="mb-1 flex justify-end">
            <button onClick={handleReset} className="text-xs font-medium text-stone-500 hover:text-stone-800">
              Reset all
            </button>
          </div>
          <div className="flex flex-col divide-y divide-stone-100">
            {(scenariosData?.scenarios ?? []).map(({ symbol }) => (
              <div key={symbol} className="flex items-center justify-between gap-2 py-1.5">
                <span className="font-mono text-sm text-stone-600">{symbol}</span>
                <ScenarioSelect
                  symbol={symbol}
                  current={scenarios.get(symbol) ?? "NORMAL_MARKET"}
                  onChanged={refetchAll}
                />
              </div>
            ))}
            {scenariosData && scenariosData.scenarios.length === 0 && (
              <p className="py-3 text-sm text-stone-400">
                Your watchlist is empty — add a symbol to simulate conditions for it.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
