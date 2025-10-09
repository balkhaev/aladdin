-- Migration: Webhook System and Active Exchange Credentials
-- Description: Adds support for webhooks and active exchange credentials selection
-- Date: 2025-10-09

-- Add active exchange credentials field to User table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "activeExchangeCredentialsId" TEXT;

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_activeExchangeCredentialsId_fkey'
    ) THEN
        ALTER TABLE "user" ADD CONSTRAINT "user_activeExchangeCredentialsId_fkey" 
            FOREIGN KEY ("activeExchangeCredentialsId") 
            REFERENCES "exchange_credentials"("id") 
            ON DELETE SET NULL;
    END IF;
END $$;

-- Create Webhooks table
CREATE TABLE IF NOT EXISTS "webhooks" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "secret" TEXT NOT NULL UNIQUE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "lastCalledAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhooks_createdById_fkey" 
        FOREIGN KEY ("createdById") 
        REFERENCES "user"("_id") 
        ON DELETE CASCADE
);

-- Create indexes for webhooks table
CREATE INDEX IF NOT EXISTS "webhooks_createdById_idx" ON "webhooks"("createdById");
CREATE INDEX IF NOT EXISTS "webhooks_isActive_idx" ON "webhooks"("isActive");

-- Create trigger to auto-update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_webhooks_updated_at'
    ) THEN
        CREATE TRIGGER update_webhooks_updated_at
            BEFORE UPDATE ON "webhooks"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE "webhooks" IS 'Webhooks for receiving trading signals from external sources';
COMMENT ON COLUMN "webhooks"."name" IS 'Strategy name that will be displayed in the UI';
COMMENT ON COLUMN "webhooks"."secret" IS 'Secret token for webhook authentication';
COMMENT ON COLUMN "webhooks"."totalCalls" IS 'Total number of times webhook was called';
COMMENT ON COLUMN "webhooks"."lastCalledAt" IS 'Timestamp of the last successful webhook call';
COMMENT ON COLUMN "user"."activeExchangeCredentialsId" IS 'Currently selected API key for auto-trading';

