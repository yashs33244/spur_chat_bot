import { NextRequest, NextResponse } from 'next/server';
import { updateConversationName } from '@/lib/repositories/conversation.repo';
import { z } from 'zod';

export const runtime = 'nodejs';

const bodySchema = z.object({ name: z.string().min(1).max(80) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

  await updateConversationName(id, parsed.data.name);
  return NextResponse.json({ success: true });
}
