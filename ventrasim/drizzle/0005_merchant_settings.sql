-- Align webhook endpoints with the merchant settings spec
ALTER TABLE "webhook_endpoints" DROP CONSTRAINT IF EXISTS "webhook_endpoints_env_unique";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'webhook_endpoints'
      AND column_name = 'id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE "webhook_endpoints" DROP CONSTRAINT IF EXISTS "webhook_endpoints_pkey";
    ALTER TABLE "webhook_endpoints" DROP COLUMN "id";
    ALTER TABLE "webhook_endpoints" ADD COLUMN "id" serial PRIMARY KEY;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'webhook_endpoints'
      AND column_name = 'env'
      AND udt_name = 'ventra_env'
  ) THEN
    ALTER TABLE "webhook_endpoints" ALTER COLUMN "env" TYPE text;
  END IF;
END$$;

ALTER TABLE "webhook_endpoints" ALTER COLUMN "is_active" SET DEFAULT false;
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "url" text;
UPDATE "webhook_endpoints" SET "url" = CONCAT('http://localhost:3000/api/webhooks/ventra/', "env") WHERE "url" IS NULL OR "url" = '';
ALTER TABLE "webhook_endpoints" ALTER COLUMN "url" SET NOT NULL;
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_endpoints_env_active_key" ON "webhook_endpoints" ("env") WHERE "is_active";

ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "endpoint_id" integer REFERENCES "webhook_endpoints"("id");
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "endpoint_url_snapshot" text;
