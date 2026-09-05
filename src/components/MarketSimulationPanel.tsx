"use client";

import { useState } from "react";
import type { DemoScenario } from "@/lib/apiTypes";
import { ScenarioSelect } from "@/components/ScenarioSelect";

/**
 * Market Simulation — a secondary, collapsible capability for testing and
 * exploring how the market brief responds to different market conditions
 * (a sudden price move, a volume spike, stale data, a provider outage,
 * ...), not a presenter-only demo mode. Forcing a scenario here just
 * changes what the synthetic provider generates for that symbol; the
 * observation still flows through the same persistence, Meaningful Change
 * Engine, and explanation pipeline as any other market data, and the
 * classification you see is always derived from the resulting numbers.
 *
 * Deliberately kept out of the way of the primary product experience —
 * collapsed by default, visually distinct (dashed border, muted kicker) —
 * but always present; it's part of the shipped product, not something
 * gated behind a flag.
 */
export function MarketSimulationPanel({
  symbols,
  scenarios,
  onReset,
  onChanged,
}: {
  symbols: string[];
  scenarios: Map<string, DemoScenario>;
  onReset: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-xs font-medium tracking-wide text-stone-400 uppercase">
          Market simulation
        </span>
        <span className="text-xs text-stone-400">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>

      {open && (
        <div className="border-t border-dashed border-stone-300 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs text-stone-500">
              Preview how the market brief responds to different market conditions — useful for
              testing and exploring the change engine, not just for presentations.
            </p>
            <button
              onClick={onReset}
              className="shrink-0 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              Reset all
            </button>
          </div>
          <div className="flex flex-col divide-y divide-stone-200">
            {symbols.map((symbol) => (
              <div key={symbol} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-sm text-stone-600">{symbol}</span>
                <ScenarioSelect
                  symbol={symbol}
                  current={scenarios.get(symbol) ?? "NORMAL_MARKET"}
                  onChanged={onChanged}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
