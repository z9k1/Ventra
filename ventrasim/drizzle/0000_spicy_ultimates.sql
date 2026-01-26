CREATE TYPE "public"."ventra_env" AS ENUM('local', 'sandbox', 'staging');--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"env" "ventra_env" NOT NULL,
	"secret" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoints_env_unique" UNIQUE("env")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"env" "ventra_env" NOT NULL,
	"event_type" text NOT NULL,
	"order_id" text NOT NULL,
	"signature_ok" boolean NOT NULL,
	"event_timestamp" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delta_ms" integer,
	"payload_json" jsonb NOT NULL,
	"headers_json" jsonb NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_webhook_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."webhook_events"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_event_attempt_idx" ON "webhook_deliveries" USING btree ("event_id","attempt_number");--> statement-breakpoint
CREATE INDEX "webhook_events_order_id_idx" ON "webhook_events" USING btree ("order_id");