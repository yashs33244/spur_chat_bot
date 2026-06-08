// Cron endpoint - called by Vercel Cron every minute.
// Finds conversations where the follow-up is due, sends VAPID push, re-schedules.
import { NextRequest } from 'next/server';
import webpush from 'web-push';
import { getPendingFollowUps, scheduleFollowUp, markFollowUpSent } from '@/lib/repositories/push-subscription.repo';

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

  const pending = await getPendingFollowUps();
  console.log(`[push-followup] found ${pending.length} pending sessions:`, pending.map(r => r.sessionId));

  if (pending.length === 0) {
    return Response.json({ sent: 0, failed: 0, total: 0, note: 'no pending subscriptions in db' });
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
        console.log(`[push-followup] sent to ${row.sessionId} endpoint ...${row.endpoint.slice(-20)} status=${response.statusCode}`);
        // Re-schedule so notifications repeat until the user replies.
        await scheduleFollowUp(row.sessionId);
        return { sessionId: row.sessionId, status: 'sent' };
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        console.error(`[push-followup] failed for ${row.sessionId} status=${status}`, err instanceof Error ? err.message : err);
        // 410 Gone / 404 = subscription expired - stop sending
        if (status === 410 || status === 404) {
          await markFollowUpSent(row.sessionId);
        }
        throw err;
      }
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => String(r.reason?.message ?? r.reason));

  console.log(`[push-followup] done sent=${sent} failed=${failed}`);

  return Response.json({ sent, failed, total: pending.length, errors: errors.length ? errors : undefined });
}
