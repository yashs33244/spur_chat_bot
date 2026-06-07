-- Follow-up scheduling on conversations
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "followup_scheduled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "followup_sent" BOOLEAN NOT NULL DEFAULT FALSE;

-- Push subscriptions (one per session/device)
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" UUID NOT NULL UNIQUE,
  "endpoint"   TEXT NOT NULL,
  "p256dh"     TEXT NOT NULL,
  "auth"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "push_subscriptions_session_id_idx" ON "push_subscriptions" ("session_id");
-- Index for cron query: find pending follow-ups
CREATE INDEX IF NOT EXISTS "conversations_followup_idx"
  ON "conversations" ("followup_scheduled_at")
  WHERE "followup_sent" = FALSE AND "followup_scheduled_at" IS NOT NULL;
