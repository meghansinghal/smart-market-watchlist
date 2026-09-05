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

export function DemoScenarioMenu({
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
      title="Demo scenario for this symbol"
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
    >
      {SCENARIOS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
