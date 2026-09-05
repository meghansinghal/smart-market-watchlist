import type {
  ApiErrorBody,
  DashboardResponse,
  DemoScenario,
  DemoScenarioEntry,
  StockDetailResponse,
  UserJSON,
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

function withUserId(path: string, userId: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}userId=${encodeURIComponent(userId)}`;
}

export const apiClient = {
  getUsers: () => request<{ users: UserJSON[] }>("/api/users"),

  getDashboard: (userId: string) => request<DashboardResponse>(withUserId("/api/dashboard", userId)),

  getStock: (userId: string, symbol: string) =>
    request<StockDetailResponse>(withUserId(`/api/stocks/${encodeURIComponent(symbol)}`, userId)),

  addWatchlistItem: (userId: string, symbol: string) =>
    request<{ item: WatchlistItemJSON }>("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ userId, symbol }),
    }),

  removeWatchlistItem: (userId: string, symbol: string) =>
    request<{ ok: true }>(withUserId(`/api/watchlist/${encodeURIComponent(symbol)}`, userId), {
      method: "DELETE",
    }),

  commitCheckpoints: (userId: string, items: { symbol: string; observationId: string }[]) =>
    request<{ outcomes: unknown[] }>("/api/checkpoints/commit", {
      method: "POST",
      body: JSON.stringify({ userId, items }),
    }),

  // Demo-scenario overrides are global (they simulate the shared market
  // observation, not anything user-specific) — only the *listing* is
  // scoped to the requesting user's own watchlist symbols.
  getDemoScenarios: (userId: string) =>
    request<{ scenarios: DemoScenarioEntry[] }>(withUserId("/api/demo/scenarios", userId)),

  setDemoScenario: (symbol: string, scenario: DemoScenario) =>
    request<{ ok: true }>("/api/demo/scenario", {
      method: "POST",
      body: JSON.stringify({ symbol, scenario }),
    }),

  resetDemo: () => request<{ ok: true }>("/api/demo/reset", { method: "POST" }),
};
