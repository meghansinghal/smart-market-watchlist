"use client";

import { useState } from "react";
import type { DemoScenario } from "@/lib/apiTypes";
import { apiClient } from "@/lib/apiClient";

const SCENARIOS: { value: DemoScenario; label: string }[] = [
  { value: "NORMAL_MARKET", label: "Normal market" },
  { value: "PRICE_SHOCK", label: "Price shock" },
  { value: "VOLUME_SPIKE", label: "Volume spike" },
  { value: "SECTOR_DIVERGENCE", label: "Sector divergence" },
  { value: "STALE_DATA", label: "Stale data" },
  { value: "PROVIDER_FAILURE", label: "Provider failure" },
];

/** Forces a symbol's underlying MarketObservation into a specific market
 * condition for testing/exploration. This does NOT set a classification —
 * it only changes what price/volume/timestamp the synthetic provider
 * generates; the Meaningful Change Engine still derives SIGNIFICANT /
 * NOTABLE / NORMAL from those numbers exactly as it would for organic
 * data. See MarketSimulationModal. */
export function ScenarioSelect({
  symbol,
  current,
  onChanged,
}: {
  symbol: string;
  current: DemoScenario;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const scenario = e.target.value as DemoScenario;
    setPending(true);
    try {
      await apiClient.setDemoScenario(symbol, scenario);
      onChanged();
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={pending}
      data-testid={`simulation-scenario-${symbol}`}
      title={`Market condition to simulate for ${symbol}`}
      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 outline-none disabled:opacity-50"
    >
      {SCENARIOS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
