/**
 * Core domain types shared across providers, services, and the API layer.
 * Keeping these independent of Prisma's generated types means business
 * logic never has to know it's talking to Postgres.
 */

export type ObservationSource = "YAHOO" | "SYNTHETIC" | "STATIC_SNAPSHOT";

export type Freshness =
  | "LIVE"
  | "DELAYED"
  | "CLOSED"
  | "STALE"
  | "CACHED"
  | "STATIC"
  | "UNAVAILABLE";

/** A raw data point as handed back by a provider, before normalization. */
export interface RawObservation {
  symbol: string;
  price: number;
  volume: number | null;
  observedAt: Date;
  source: ObservationSource;
}

/** A fully normalized market data point, as used throughout the app. */
export interface MarketObservation {
  id: string;
  symbol: string;
  price: number;
  volume: number | null;
  observedAt: Date;
  receivedAt: Date;
  source: ObservationSource;
  freshness: Freshness;
}

export type MarketDataResult =
  | { ok: true; observation: MarketObservation }
  | { ok: false; symbol: string; reason: "unavailable"; message: string };

export interface HistoricalBar {
  symbol: string;
  date: Date;
  close: number;
  volume: number | null;
}

export interface Checkpoint {
  symbol: string;
  price: number;
  volume: number | null;
  observedAt: Date;
  source: ObservationSource;
  freshness: Freshness;
  checkedAt: Date;
}

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

export type ChangeClassification = "NORMAL" | "NOTABLE" | "SIGNIFICANT";

/** Whether we have enough trustworthy data to classify a change at all. */
export type DataStatus = "OK" | "LIMITED" | "UNAVAILABLE" | "NEW";

export interface ChangeScoreBreakdown {
  movementScore: number;
  unusualnessScore: number;
  divergenceScore: number;
  volumeScore: number;
  attentionScore: number;
}

export interface ChangeResult {
  symbol: string;
  dataStatus: DataStatus;
  classification: ChangeClassification | null;
  scores: ChangeScoreBreakdown | null;
  reasons: ChangeReason[];
  pctChangeSinceCheckpoint: number | null;
  currentObservation: MarketObservation | null;
  previousCheckpoint: Checkpoint | null;
  benchmarkSymbol: string | null;
  historicalDaysUsed: number;
}
