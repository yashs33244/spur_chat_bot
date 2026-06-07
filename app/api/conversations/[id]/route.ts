import { NextRequest, NextResponse } from 'next/server';
import { deleteConversation } from '@/lib/repositories/conversation.repo';
import { getMessages } from '@/lib/repositories/message.repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await getMessages(id);
  return NextResponse.json({ messages });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteConversation(id);
  return NextResponse.json({ success: true });
}
