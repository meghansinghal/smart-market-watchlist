-- CreateEnum
CREATE TYPE "ObservationSource" AS ENUM ('YAHOO', 'SYNTHETIC', 'STATIC_SNAPSHOT');

-- CreateEnum
CREATE TYPE "Freshness" AS ENUM ('LIVE', 'DELAYED', 'STALE', 'CACHED', 'STATIC', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "DemoScenario" AS ENUM ('NORMAL_MARKET', 'PRICE_SHOCK', 'VOLUME_SPIKE', 'SECTOR_DIVERGENCE', 'STALE_DATA', 'PROVIDER_FAILURE');

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketObservation" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "ObservationSource" NOT NULL,
    "freshness" "Freshness" NOT NULL,

    CONSTRAINT "MarketObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalBar" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT,

    CONSTRAINT "HistoricalBar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "symbol" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "source" "ObservationSource" NOT NULL,
    "freshness" "Freshness" NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "DemoScenarioState" (
    "symbol" TEXT NOT NULL,
    "scenario" "DemoScenario" NOT NULL DEFAULT 'NORMAL_MARKET',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoScenarioState_pkey" PRIMARY KEY ("symbol")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_symbol_key" ON "WatchlistItem"("symbol");

-- CreateIndex
CREATE INDEX "WatchlistItem_symbol_idx" ON "WatchlistItem"("symbol");

-- CreateIndex
CREATE INDEX "MarketObservation_symbol_observedAt_idx" ON "MarketObservation"("symbol", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "MarketObservation_symbol_receivedAt_idx" ON "MarketObservation"("symbol", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "HistoricalBar_symbol_date_idx" ON "HistoricalBar"("symbol", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalBar_symbol_date_key" ON "HistoricalBar"("symbol", "date");
