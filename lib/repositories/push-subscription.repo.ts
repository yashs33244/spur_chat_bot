import { getDb, schema } from '@/lib/db';
import { eq, and, lte, gte, isNotNull, ne, inArray } from 'drizzle-orm';

// Save or refresh the push subscription for a physical device.
// Unique on deviceId - one row per device. sessionId records which session triggered this.
export async function upsertPushSubscription(
  deviceId: string,
  sessionId: string,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  const db = getDb();
  await db
    .insert(schema.pushSubscriptions)
    .values({ deviceId, sessionId, endpoint, p256dh, auth, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [schema.pushSubscriptions.deviceId],
      set: { sessionId, endpoint, p256dh, auth, updatedAt: new Date() },
    });
}

// Schedule a follow-up push for a session.
// Records which device was last active. Cancels pending follow-ups on ALL other sessions
// from the same device so a user with multiple open sessions only ever gets one notification.
export async function scheduleFollowUp(sessionId: string, deviceId: string) {
  const db = getDb();
  const followupAt = new Date(Date.now() + 10 * 1000); // TEST: 10s - DO NOT CHANGE

  if (deviceId) {
    // Cancel every other pending follow-up from the same device
    await db
      .update(schema.conversations)
      .set({ followupScheduledAt: null, followupSent: true })
      .where(
        and(
          eq(schema.conversations.lastActiveDeviceId, deviceId),
          ne(schema.conversations.id, sessionId)
        )
      );
  }

  await db
    .update(schema.conversations)
    .set({ followupScheduledAt: followupAt, followupSent: false, lastActiveDeviceId: deviceId })
    .where(eq(schema.conversations.id, sessionId));
}

export async function cancelFollowUp(sessionId: string) {
  const db = getDb();
  await db
    .update(schema.conversations)
    .set({ followupScheduledAt: null, followupSent: true })
    .where(eq(schema.conversations.id, sessionId));
}

// Atomically claim pending follow-ups and return them with their push subscription details.
// SET followup_sent=true BEFORE reading, so two concurrent cron workers can't claim the same row.
export async function claimAndGetPendingFollowUps() {
  const db = getDb();
  const now = new Date();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Atomically claim: mark as sent before we process
  const claimed = await db
    .update(schema.conversations)
    .set({ followupSent: true })
    .where(
      and(
        isNotNull(schema.conversations.followupScheduledAt),
        lte(schema.conversations.followupScheduledAt, now),
        eq(schema.conversations.followupSent, false),
        gte(schema.conversations.createdAt, cutoff),
        isNotNull(schema.conversations.lastActiveDeviceId)
      )
    )
    .returning({
      sessionId: schema.conversations.id,
      deviceId: schema.conversations.lastActiveDeviceId,
    });

  if (!claimed.length) return [];

  const deviceIds = claimed
    .map((r) => r.deviceId)
    .filter((d): d is string => d !== null);

  if (!deviceIds.length) return [];

  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(inArray(schema.pushSubscriptions.deviceId, deviceIds));

  const subByDevice = new Map(subs.map((s) => [s.deviceId, s]));

  return claimed
    .map((c) => {
      const sub = c.deviceId ? subByDevice.get(c.deviceId) : undefined;
      if (!sub) return null;
      return {
        sessionId: c.sessionId,
        deviceId: c.deviceId!,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

// Re-schedule the next follow-up after a successful send.
// Called after webpush.sendNotification succeeds.
export async function rescheduleFollowUp(sessionId: string) {
  const db = getDb();
  const followupAt = new Date(Date.now() + 10 * 1000); // TEST: 10s - DO NOT CHANGE
  await db
    .update(schema.conversations)
    .set({ followupScheduledAt: followupAt, followupSent: false })
    .where(eq(schema.conversations.id, sessionId));
}

export async function markFollowUpSent(sessionId: string) {
  const db = getDb();
  await db
    .update(schema.conversations)
    .set({ followupSent: true, followupScheduledAt: null })
    .where(eq(schema.conversations.id, sessionId));
}
