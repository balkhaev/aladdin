-- AlterTable
ALTER TABLE "user" ADD COLUMN     "activeExchangeCredentialsId" TEXT;

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "lastCalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhooks_secret_key" ON "webhooks"("secret");

-- CreateIndex
CREATE INDEX "webhooks_createdById_idx" ON "webhooks"("createdById");

-- CreateIndex
CREATE INDEX "webhooks_isActive_idx" ON "webhooks"("isActive");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_activeExchangeCredentialsId_fkey" FOREIGN KEY ("activeExchangeCredentialsId") REFERENCES "exchange_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
