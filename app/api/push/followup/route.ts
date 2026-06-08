// Cron endpoint - called by Vercel Cron every minute.
// Atomically claims due follow-ups, sends VAPID push, re-schedules for next interval.
import { NextRequest } from 'next/server';
import webpush from 'web-push';
import {
  claimAndGetPendingFollowUps,
  rescheduleFollowUp,
  markFollowUpSent,
} from '@/lib/repositories/push-subscription.repo';

export const runtime = 'nodejs';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'support@spurnow.com';
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push-followup] VAPID keys not configured');
    return Response.json({ error: 'VAPID keys not configured' }, { status: 503 });
  }

  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  // Atomic claim: marks rows as sent before reading so concurrent cron runs can't double-send
  const pending = await claimAndGetPendingFollowUps();
  console.log(`[push-followup] claimed ${pending.length} sessions:`, pending.map((r) => `${r.sessionId}@${r.deviceId.slice(0, 8)}`));

  if (!pending.length) {
    return Response.json({ sent: 0, failed: 0, total: 0 });
  }

  const results = await Promise.allSettled(
    pending.map(async (row) => {
      const payload = JSON.stringify({
        title: 'Spur Support - Quick Check',
        body: 'Did we resolve your issue? We are here if you need more help.',
        url: `/${row.sessionId}`,
      });

      try {
        const response = await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload
        );
        console.log(`[push-followup] sent session=${row.sessionId} device=${row.deviceId.slice(0, 8)} status=${response.statusCode}`);
        // Reschedule: repeat until the user replies (cancelFollowUp stops the loop)
        await rescheduleFollowUp(row.sessionId);
        return { sessionId: row.sessionId, status: 'sent' };
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        console.error(`[push-followup] FAILED session=${row.sessionId} device=${row.deviceId.slice(0, 8)} status=${status}`, err instanceof Error ? err.message : err);
        if (status === 410 || status === 404) {
          // Subscription expired - stop sending permanently
          await markFollowUpSent(row.sessionId);
        }
        // For other errors: row is already claimed (sent=true). The reschedule
        // was not called, so this session stops until the user sends another message.
        throw err;
      }
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => String((r.reason as Error)?.message ?? r.reason));

  console.log(`[push-followup] done sent=${sent} failed=${failed}`);
  return Response.json({ sent, failed, total: pending.length, errors: errors.length ? errors : undefined });
}
