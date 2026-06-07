CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "sender" text NOT NULL,
  "text" text NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "conversations_created_at_idx" ON "conversations" ("created_at" DESC);
