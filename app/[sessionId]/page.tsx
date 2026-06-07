import { ChatInterface } from '@/components/features/chat/ChatInterface';
import { getMessages } from '@/lib/repositories/message.repo';

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionPage({ params }: Props) {
  const { sessionId } = await params;
  const initialMessages = await getMessages(sessionId).catch(() => []);
  return <ChatInterface initialSessionId={sessionId} initialMessages={initialMessages} />;
}
