-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL,
    "pair" TEXT,
    "timeframe" TEXT,
    "term" TEXT,
    "direction" TEXT,
    "entry_zone_min" DOUBLE PRECISION,
    "entry_zone_max" DOUBLE PRECISION,
    "strategy_accuracy" DOUBLE PRECISION,
    "last_signals" JSONB,
    "targets" JSONB,
    "trend_line" DOUBLE PRECISION,
    "stop_loss" DOUBLE PRECISION,
    "raw" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signals_pair_idx" ON "signals"("pair");

-- CreateIndex
CREATE INDEX "signals_timestamp_idx" ON "signals"("timestamp");
