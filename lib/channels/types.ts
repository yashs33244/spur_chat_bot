export interface IncomingMessage {
  text: string;
  sessionId: string;
  channel: 'live-chat' | 'whatsapp' | 'instagram' | 'facebook';
  metadata?: Record<string, string>;
}

export interface OutgoingMessage {
  text: string;
  sessionId: string;
}

export interface ChannelAdapter {
  channel: IncomingMessage['channel'];
  normalizeIncoming(raw: unknown): IncomingMessage;
  formatOutgoing(msg: OutgoingMessage): unknown;
}
