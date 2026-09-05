/**
 * Client-facing mirrors of the server domain types, with Date fields as
 * ISO strings (what actually crosses the wire as JSON) instead of `Date`.
 * Kept separate from `@/server/domain/types` so client components never
 * need to reason about serialization.
 */

export type ObservationSource = "YAHOO" | "SYNTHETIC" | "STATIC_SNAPSHOT";
export type Freshness = "LIVE" | "DELAYED" | "CLOSED" | "STALE" | "CACHED" | "STATIC" | "UNAVAILABLE";
export type ChangeClassification = "NORMAL" | "NOTABLE" | "SIGNIFICANT";
export type DataStatus = "OK" | "LIMITED" | "UNAVAILABLE" | "NEW";
export type DemoScenario =
  | "NORMAL_MARKET"
  | "PRICE_SHOCK"
  | "VOLUME_SPIKE"
  | "SECTOR_DIVERGENCE"
  | "STALE_DATA"
  | "PROVIDER_FAILURE";

export type ChangeReason =
  | "LARGE_PRICE_MOVE"
  | "UNUSUAL_FOR_STOCK"
  | "SECTOR_DIVERGENCE"
  | "UNUSUAL_VOLUME"
  | "SECTOR_ALIGNED_MOVE"
  | "LIMITED_PRICE_MOVEMENT"
  | "HISTORICAL_CONTEXT_UNAVAILABLE"
  | "FIRST_OBSERVATION"
  | "STALE_DATA"
  | "DATA_UNAVAILABLE";

export interface ObservationJSON {
  id: string;
  symbol: string;
  price: number;
  volume: number | null;
  observedAt: string;
  receivedAt: string;
  source: ObservationSource;
  freshness: Freshness;
}

export interface CheckpointJSON {
  symbol: string;
  price: number;
  volume: number | null;
  observedAt: string;
  source: ObservationSource;
  freshness: Freshness;
  checkedAt: string;
}

export interface ChangeScoreBreakdown {
  movementScore: number;
  unusualnessScore: number;
  divergenceScore: number;
  volumeScore: number;
  attentionScore: number;
}

export interface ChangeResultJSON {
  symbol: string;
  dataStatus: DataStatus;
  classification: ChangeClassification | null;
  scores: ChangeScoreBreakdown | null;
  reasons: ChangeReason[];
  pctChangeSinceCheckpoint: number | null;
  currentObservation: ObservationJSON | null;
  previousCheckpoint: CheckpointJSON | null;
  benchmarkSymbol: string | null;
  historicalDaysUsed: number;
}

export interface Explanation {
  headline: string;
  bullets: string[];
}

export interface SymbolBriefJSON {
  symbol: string;
  observation: ObservationJSON | null;
  unavailableMessage: string | null;
  change: ChangeResultJSON | null;
  explanation: Explanation | null;
}

export interface DashboardResponse {
  generatedAt: string;
  marketOpen: boolean;
  items: SymbolBriefJSON[];
}

export interface HistoricalBarJSON {
  symbol: string;
  date: string;
  close: number;
  volume: number | null;
}

export interface StockDetailResponse extends SymbolBriefJSON {
  benchmarkSymbol: string;
  historicalBars: HistoricalBarJSON[];
}

export interface WatchlistItemJSON {
  id: string;
  symbol: string;
  addedAt: string;
}

export interface DemoScenarioEntry {
  symbol: string;
  scenario: DemoScenario;
}

export interface ApiErrorBody {
  error: string;
  message?: string;
}
