"use client";

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/apiClient";

export function AddSymbolForm({ userId, onAdded }: { userId: string; onAdded: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.addWatchlistItem(userId, symbol);
      setSymbol("");
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that symbol.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Add a symbol, e.g. WIPRO.NS"
          className="w-full max-w-xs rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400"
        />
        <button
          type="submit"
          disabled={submitting || !symbol.trim()}
          className="shrink-0 rounded-lg bg-stone-800 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
