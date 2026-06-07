import { pgTable, uuid, text, timestamp, jsonb, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, string>>().default({}),
  followupScheduledAt: timestamp('followup_scheduled_at'),
  followupSent: boolean('followup_sent').default(false).notNull(),
});

// One subscription per (session, device endpoint). Multiple devices can subscribe to the same session.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  sessionEndpointUniq: uniqueIndex('push_subscriptions_session_endpoint_uniq').on(t.sessionId, t.endpoint),
}));

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  sender: text('sender', { enum: ['user', 'ai'] }).notNull(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  followUps: jsonb('follow_ups').$type<string[]>().default([]),
});
