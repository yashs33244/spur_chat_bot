import { getDb, schema } from '@/lib/db';
import { eq, desc, sql } from 'drizzle-orm';
import type { Conversation } from '@/types/conversation';

export async function listConversations(): Promise<Conversation[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.conversations.id,
      name: schema.conversations.name,
      createdAt: schema.conversations.createdAt,
      lastMessage: sql<string>`(SELECT text FROM messages WHERE conversation_id = conversations.id ORDER BY timestamp DESC LIMIT 1)`,
    })
    .from(schema.conversations)
    .orderBy(desc(schema.conversations.createdAt))
    .limit(50);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getConversation(id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createConversation(id?: string) {
  const db = getDb();
  const [conv] = await db
    .insert(schema.conversations)
    .values({ ...(id ? { id } : {}), metadata: {} })
    .returning();
  return conv;
}

export async function updateConversationName(id: string, name: string) {
  const db = getDb();
  await db.update(schema.conversations).set({ name }).where(eq(schema.conversations.id, id));
}

export async function deleteConversation(id: string) {
  const db = getDb();
  await db.delete(schema.conversations).where(eq(schema.conversations.id, id));
}
