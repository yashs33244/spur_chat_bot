import { NextRequest } from 'next/server';
import { z } from 'zod';
import { upsertPushSubscription } from '@/lib/repositories/push-subscription.repo';

export const runtime = 'nodejs';

const bodySchema = z.object({
  deviceId: z.string().min(1),
  sessionId: z.string().uuid(),
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid subscription data' }, { status: 400 });
  }

  const { deviceId, sessionId, endpoint, p256dh, auth } = parsed.data;
  await upsertPushSubscription(deviceId, sessionId, endpoint, p256dh, auth);

  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  if (!deviceId) return Response.json({ error: 'Missing deviceId' }, { status: 400 });

  const { getDb, schema } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');
  const db = getDb();
  await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.deviceId, deviceId));

  return Response.json({ ok: true });
}
