import { pgTable, uuid, text, timestamp, jsonb, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, string>>().default({}),
  followupScheduledAt: timestamp('followup_scheduled_at'),
  followupSent: boolean('followup_sent').default(false).notNull(),
  // The stable device ID of the last device that sent a message in this conversation.
  // The cron uses this to look up which endpoint to push to.
  lastActiveDeviceId: text('last_active_device_id'),
});

// One row per physical device (keyed by deviceId).
// deviceId is a UUID generated once per device and persisted in localStorage.
// sessionId is the most recent chat session that device subscribed from.
// updatedAt tracks the last time this device refreshed its subscription.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: text('device_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  deviceUniq: uniqueIndex('push_subscriptions_device_uniq').on(t.deviceId),
}));

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  sender: text('sender', { enum: ['user', 'ai'] }).notNull(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  followUps: jsonb('follow_ups').$type<string[]>().default([]),
});
