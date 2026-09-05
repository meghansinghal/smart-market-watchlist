"use client";

import { useMemo, useState } from "react";
import { apiClient, ApiError } from "@/lib/apiClient";
import { searchKnownSymbols } from "@/lib/displayNames";

export function AddSymbolForm({ userId, onAdded }: { userId: string; onAdded: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // Client-side filter over a small curated list of well-known symbols —
  // no network call, so it's independent of which market-data provider is
  // configured. Typing a symbol that isn't in this list still works fine when
  // submitted directly; it just won't show a suggestion.
  const suggestions = useMemo(() => searchKnownSymbols(symbol), [symbol]);

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

  function selectSuggestion(sym: string) {
    setSymbol(sym);
    setSuggestionsOpen(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <div className="relative w-full max-w-xs">
          <input
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => setTimeout(() => setSuggestionsOpen(false), 100)}
            placeholder="Add a symbol, e.g. WIPRO.NS"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400"
          />
          {suggestionsOpen && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full min-w-[16rem] rounded-lg border border-stone-200 bg-white py-1 shadow-md">
              {suggestions.map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s.symbol)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-stone-50"
                  >
                    <span className="font-mono text-stone-800">{s.symbol}</span>
                    <span className="truncate text-xs text-stone-400">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
