import { getDb, schema } from '@/lib/db';
import { eq, and, lte, gte, isNotNull } from 'drizzle-orm';

export async function upsertPushSubscription(
  sessionId: string,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  const db = getDb();
  await db
    .insert(schema.pushSubscriptions)
    .values({ sessionId, endpoint, p256dh, auth })
    .onConflictDoUpdate({
      target: [schema.pushSubscriptions.sessionId, schema.pushSubscriptions.endpoint],
      set: { p256dh, auth },
    });
}

export async function getPushSubscription(sessionId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.sessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function scheduleFollowUp(sessionId: string) {
  const db = getDb();
  const followupAt = new Date(Date.now() + 10 * 1000);
  await db
    .update(schema.conversations)
    .set({ followupScheduledAt: followupAt, followupSent: false })
    .where(eq(schema.conversations.id, sessionId));
}

export async function cancelFollowUp(sessionId: string) {
  const db = getDb();
  await db
    .update(schema.conversations)
    .set({ followupScheduledAt: null, followupSent: true })
    .where(eq(schema.conversations.id, sessionId));
}

export async function getPendingFollowUps() {
  const db = getDb();
  const now = new Date();
  return db
    .select({
      sessionId: schema.conversations.id,
      endpoint: schema.pushSubscriptions.endpoint,
      p256dh: schema.pushSubscriptions.p256dh,
      auth: schema.pushSubscriptions.auth,
    })
    .from(schema.conversations)
    .innerJoin(
      schema.pushSubscriptions,
      eq(schema.pushSubscriptions.sessionId, schema.conversations.id)
    )
    .where(
      and(
        isNotNull(schema.conversations.followupScheduledAt),
        lte(schema.conversations.followupScheduledAt, now),
        eq(schema.conversations.followupSent, false),
        // Stop pushing for sessions older than 24 hours - prevents stale sessions from spamming
        gte(schema.conversations.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    )
    .limit(50);
}

export async function markFollowUpSent(sessionId: string) {
  const db = getDb();
  await db
    .update(schema.conversations)
    .set({ followupSent: true })
    .where(eq(schema.conversations.id, sessionId));
}
