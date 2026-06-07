import { getDb, schema } from '@/lib/db';
import { eq, asc, desc } from 'drizzle-orm';
import type { Message } from '@/types/conversation';

export async function getMessages(conversationId: string): Promise<Message[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(asc(schema.messages.timestamp));

  return rows.map((r) => ({
    ...r,
    timestamp: r.timestamp.toISOString(),
    followUps: (r.followUps as string[]) ?? [],
  }));
}

export async function persistMessage(conversationId: string, sender: 'user' | 'ai', text: string) {
  const db = getDb();
  const [msg] = await db
    .insert(schema.messages)
    .values({ conversationId, sender, text })
    .returning();
  return msg;
}

export async function updateLastAiMessageFollowUps(conversationId: string, followUps: string[]): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(desc(schema.messages.timestamp))
    .limit(1);

  const lastMsg = rows[0];
  if (!lastMsg) return;

  await db
    .update(schema.messages)
    .set({ followUps })
    .where(eq(schema.messages.id, lastMsg.id));
}

export async function countMessages(conversationId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId));
  return rows.length;
}
