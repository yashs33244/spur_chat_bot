// Cron endpoint - called by Vercel Cron every minute.
// Finds conversations where the follow-up is due, sends VAPID push,
// marks them as sent.
import { NextRequest } from 'next/server';
import webpush from 'web-push';
import { getPendingFollowUps, scheduleFollowUp, markFollowUpSent } from '@/lib/repositories/push-subscription.repo';

export const runtime = 'nodejs';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'support@spurnow.com';

// Guard: reject requests without the internal cron secret to prevent abuse
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Vercel Cron sets this header automatically when CRON_SECRET is configured
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ error: 'VAPID keys not configured' }, { status: 503 });
  }

  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const pending = await getPendingFollowUps();
  const results = await Promise.allSettled(
    pending.map(async (row: { sessionId: string; endpoint: string; p256dh: string; auth: string }) => {
      const payload = JSON.stringify({
        title: 'Spur Support - Quick Check',
        body: 'Did we resolve your issue? We are here if you need more help.',
        url: `/${row.sessionId}`,
      });

      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload
        );
        // Re-schedule next follow-up so notifications keep coming until user replies.
        // cancelFollowUp() in chat route stops this when the user sends a message.
        await scheduleFollowUp(row.sessionId);
      } catch (err: unknown) {
        // 410 Gone = subscription expired/unsubscribed - stop sending to it
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await markFollowUpSent(row.sessionId);
        }
        throw err;
      }
    })
  );

  const sent = results.filter((r: PromiseSettledResult<void>) => r.status === 'fulfilled').length;
  const failed = results.filter((r: PromiseSettledResult<void>) => r.status === 'rejected').length;

  return Response.json({ sent, failed, total: pending.length });
}
