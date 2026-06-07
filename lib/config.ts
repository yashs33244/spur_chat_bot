import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  LLM_PROVIDER: z.enum(['openai', 'openai_compatible', 'anthropic', 'openrouter', 'gemini', 'deepseek', 'ollama']).default('gemini'),
  LLM_MODEL: z.string().default('gemini-2.0-flash-lite'),
  LLM_API_KEY: z.string().min(1),
  LLM_API_BASE: z.string().optional(),
  MAX_CONTEXT_MESSAGES: z.coerce.number().default(20),
  MAX_MESSAGE_LENGTH: z.coerce.number().default(2000),
  RATE_LIMIT_RPM: z.coerce.number().default(20),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const config = envSchema.parse(process.env);
