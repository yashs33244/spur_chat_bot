import type { ChannelAdapter, IncomingMessage, OutgoingMessage } from './types';

export class LiveChatAdapter implements ChannelAdapter {
  channel = 'live-chat' as const;

  normalizeIncoming(raw: { message: string; sessionId?: string }): IncomingMessage {
    return {
      text: raw.message,
      sessionId: raw.sessionId || '',
      channel: 'live-chat',
    };
  }

  formatOutgoing(msg: OutgoingMessage): { reply: string; sessionId: string } {
    return { reply: msg.text, sessionId: msg.sessionId };
  }
}

export const liveChatAdapter = new LiveChatAdapter();
