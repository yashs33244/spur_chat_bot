-- Device-based push subscriptions.
-- Previously: one subscription per (session_id, endpoint).
-- Now: one subscription per physical device. deviceId is a UUID stored in localStorage.
--     sessionId is kept to record which session the device last subscribed from.
-- conversations get last_active_device_id so the cron knows which device to push to.

-- 1. Drop old session-scoped constraint and column
DROP INDEX IF EXISTS "push_subscriptions_session_endpoint_uniq";
DROP INDEX IF EXISTS "push_subscriptions_session_id_idx";

-- 2. Add device_id and updated_at columns
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "device_id" TEXT;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Migrate existing rows: use session_id as a temporary device_id placeholder
--    (these rows have no real deviceId - they'll be replaced when devices re-subscribe)
UPDATE "push_subscriptions" SET "device_id" = "session_id"::TEXT WHERE "device_id" IS NULL;

-- 4. Make device_id NOT NULL and unique
ALTER TABLE "push_subscriptions" ALTER COLUMN "device_id" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_device_uniq" ON "push_subscriptions" ("device_id");

-- 5. Add last_active_device_id to conversations
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "last_active_device_id" TEXT;
