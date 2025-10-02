/*
  Warnings:

  - Added the required column `apiSecretAuthTag` to the `exchange_credentials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `apiSecretIv` to the `exchange_credentials` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "exchange_credentials" ADD COLUMN     "apiSecretAuthTag" TEXT NOT NULL,
ADD COLUMN     "apiSecretIv" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "exchange" TEXT NOT NULL DEFAULT 'binance',
ADD COLUMN     "exchangeCredentialsId" TEXT;

-- CreateTable
CREATE TABLE "risk_limits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioId" TEXT,
    "type" TEXT NOT NULL,
    "value" DECIMAL(20,8) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_limits_userId_idx" ON "risk_limits"("userId");

-- CreateIndex
CREATE INDEX "risk_limits_portfolioId_idx" ON "risk_limits"("portfolioId");

-- CreateIndex
CREATE INDEX "positions_exchange_idx" ON "positions"("exchange");

-- AddForeignKey
ALTER TABLE "risk_limits" ADD CONSTRAINT "risk_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_limits" ADD CONSTRAINT "risk_limits_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
