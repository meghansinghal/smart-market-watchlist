"use client";

import { useState } from "react";
import type { DemoScenario } from "@/lib/apiTypes";
import { DemoScenarioMenu } from "@/components/DemoScenarioMenu";

/** Demo/presenter tooling, deliberately kept out of the way of the actual
 * product experience — collapsed by default, visually distinct (dashed
 * border, muted kicker) so it never reads as part of the consumer UI. */
export function DemoModePanel({
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
          For presenters · Demo mode
        </span>
        <span className="text-xs text-stone-400">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>

      {open && (
        <div className="border-t border-dashed border-stone-300 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-stone-500">
              Force a scenario per symbol to preview how the dashboard reacts.
            </p>
            <button onClick={onReset} className="text-xs font-medium text-stone-500 hover:text-stone-800">
              Reset all
            </button>
          </div>
          <div className="flex flex-col divide-y divide-stone-200">
            {symbols.map((symbol) => (
              <div key={symbol} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-sm text-stone-600">{symbol}</span>
                <DemoScenarioMenu
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
