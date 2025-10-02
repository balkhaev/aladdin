-- CreateTable
CREATE TABLE "portfolio_rebalances" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "totalCost" DECIMAL(20,8) NOT NULL,
    "netBenefit" DECIMAL(20,8) NOT NULL,
    "priority" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_rebalances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_rebalances_portfolioId_idx" ON "portfolio_rebalances"("portfolioId");

-- CreateIndex
CREATE INDEX "portfolio_rebalances_createdAt_idx" ON "portfolio_rebalances"("createdAt");

-- AddForeignKey
ALTER TABLE "portfolio_rebalances" ADD CONSTRAINT "portfolio_rebalances_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
