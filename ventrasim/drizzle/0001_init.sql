CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ventra_env" AS ENUM ('local', 'sandbox', 'staging');

CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" "ventra_env" NOT NULL UNIQUE,
  "secret" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" text NOT NULL UNIQUE,
  "env" "ventra_env" NOT NULL,
  "event_type" text NOT NULL,
  "order_id" text NOT NULL,
  "signature_ok" boolean NOT NULL,
  "event_timestamp" timestamptz NULL,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "delta_ms" integer NULL,
  "payload_json" jsonb NOT NULL,
  "headers_json" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "webhook_events_order_id_idx" ON "webhook_events" ("order_id");

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" text NOT NULL REFERENCES "webhook_events"("event_id") ON DELETE CASCADE,
  "attempt_number" integer NOT NULL,
  "status" text NOT NULL,
  "error_message" text NULL,
  "received_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "webhook_deliveries_event_attempt_idx" ON "webhook_deliveries" ("event_id", "attempt_number");
