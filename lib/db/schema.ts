import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, string>>().default({}),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  sender: text('sender', { enum: ['user', 'ai'] }).notNull(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  followUps: jsonb('follow_ups').$type<string[]>().default([]),
});
