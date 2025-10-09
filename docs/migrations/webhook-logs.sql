-- Migration: Webhook Logs
-- Description: Adds webhook_logs table for tracking webhook calls
-- Date: 2025-10-09

-- Create webhook_logs table
CREATE TABLE IF NOT EXISTS "webhook_logs" (
    "id" TEXT PRIMARY KEY,
    "webhookId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "signal" TEXT,
    "response" TEXT,
    "error" TEXT,
    "duration" INTEGER,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_logs_webhookId_fkey" 
        FOREIGN KEY ("webhookId") 
        REFERENCES "webhooks"("id") 
        ON DELETE CASCADE
);

-- Create indexes for webhook_logs table
CREATE INDEX IF NOT EXISTS "webhook_logs_webhookId_idx" ON "webhook_logs"("webhookId");
CREATE INDEX IF NOT EXISTS "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "webhook_logs_success_idx" ON "webhook_logs"("success");

-- Add comments for documentation
COMMENT ON TABLE "webhook_logs" IS 'Logs of webhook calls for tracking and debugging';
COMMENT ON COLUMN "webhook_logs"."signal" IS 'JSON representation of the signal received';
COMMENT ON COLUMN "webhook_logs"."response" IS 'JSON representation of the response sent';
COMMENT ON COLUMN "webhook_logs"."error" IS 'Error message if the webhook call failed';
COMMENT ON COLUMN "webhook_logs"."duration" IS 'Duration of webhook processing in milliseconds';

