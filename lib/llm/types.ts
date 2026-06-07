export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type SupportedProvider =
  | 'openai'
  | 'openai_compatible'
  | 'anthropic'
  | 'openrouter'
  | 'gemini'
  | 'deepseek'
  | 'ollama';
