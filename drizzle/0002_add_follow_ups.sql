ALTER TABLE messages ADD COLUMN IF NOT EXISTS follow_ups jsonb DEFAULT '[]'::jsonb;
