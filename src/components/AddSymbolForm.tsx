"use client";

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/apiClient";

export function AddSymbolForm({ onAdded }: { onAdded: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.addWatchlistItem(symbol);
      setSymbol("");
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that symbol.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex flex-1 gap-2">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Add a symbol, e.g. WIPRO.NS"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={submitting || !symbol.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 sm:pt-2">{error}</p>}
    </form>
  );
}
