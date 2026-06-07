-- Allow multiple device subscriptions per session.
-- Previously: UNIQUE(session_id) - only one device per session.
-- Now: UNIQUE(session_id, endpoint) - one subscription per device per session.

ALTER TABLE "push_subscriptions" DROP CONSTRAINT IF EXISTS "push_subscriptions_session_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_session_endpoint_uniq"
  ON "push_subscriptions" ("session_id", "endpoint");
