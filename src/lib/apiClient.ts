import type {
  ApiErrorBody,
  DashboardResponse,
  DemoScenario,
  DemoScenarioEntry,
  StockDetailResponse,
  WatchlistItemJSON,
} from "@/lib/apiTypes";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(body?.message ?? body?.error ?? `Request to ${input} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  getDashboard: () => request<DashboardResponse>("/api/dashboard"),

  getStock: (symbol: string) => request<StockDetailResponse>(`/api/stocks/${encodeURIComponent(symbol)}`),

  addWatchlistItem: (symbol: string) =>
    request<{ item: WatchlistItemJSON }>("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),

  removeWatchlistItem: (symbol: string) =>
    request<{ ok: true }>(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" }),

  commitCheckpoints: (items: { symbol: string; observationId: string }[]) =>
    request<{ outcomes: unknown[] }>("/api/checkpoints/commit", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  getDemoScenarios: () => request<{ scenarios: DemoScenarioEntry[] }>("/api/demo/scenarios"),

  setDemoScenario: (symbol: string, scenario: DemoScenario) =>
    request<{ ok: true }>("/api/demo/scenario", {
      method: "POST",
      body: JSON.stringify({ symbol, scenario }),
    }),

  resetDemo: () => request<{ ok: true }>("/api/demo/reset", { method: "POST" }),
};
