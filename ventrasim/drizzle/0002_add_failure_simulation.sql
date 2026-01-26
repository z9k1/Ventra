ALTER TABLE "webhook_endpoints" ADD COLUMN "delivery_mode" text DEFAULT 'normal' NOT NULL;
ALTER TABLE "webhook_endpoints" ADD COLUMN "timeout_ms" integer DEFAULT 15000 NOT NULL;
ALTER TABLE "webhook_deliveries" ADD COLUMN "mode_used" text;
ALTER TABLE "webhook_deliveries" ADD COLUMN "latency_ms" integer;
