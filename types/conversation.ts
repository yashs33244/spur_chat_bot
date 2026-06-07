export type Conversation = {
  id: string;
  name: string | null;
  createdAt: string;
  lastMessage: string | null;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  followUps?: string[];
};
