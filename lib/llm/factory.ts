import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { SupportedProvider } from './types';

function getEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export function createLLMModel() {
  const provider = getEnv('LLM_PROVIDER', 'gemini') as SupportedProvider;
  const model = getEnv('LLM_MODEL', 'gemini-1.5-flash');
  const apiKey = getEnv('LLM_API_KEY');
  const apiBase = getEnv('LLM_API_BASE');

  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model as Parameters<ReturnType<typeof createAnthropic>>[0]);
    }
    case 'gemini': {
      const gemini = createGoogleGenerativeAI({ apiKey });
      return gemini(model as Parameters<ReturnType<typeof createGoogleGenerativeAI>>[0]);
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    case 'openrouter': {
      const openai = createOpenAI({
        apiKey,
        baseURL: apiBase || 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': 'https://spur-chat-agent.vercel.app',
          'X-Title': 'Spur Chat Agent',
        },
      });
      return openai(model);
    }
    case 'deepseek': {
      const openai = createOpenAI({ apiKey, baseURL: apiBase || 'https://api.deepseek.com/v1' });
      return openai(model);
    }
    case 'ollama': {
      const openai = createOpenAI({
        apiKey: apiKey || 'ollama',
        baseURL: (apiBase || 'http://localhost:11434') + '/v1',
      });
      return openai(model);
    }
    case 'openai_compatible': {
      const openai = createOpenAI({
        apiKey: apiKey || 'local',
        baseURL: apiBase || 'http://localhost:8080/v1',
      });
      return openai(model);
    }
    default:
      throw new Error(
        `Unsupported LLM provider: ${provider}. Supported: openai, openai_compatible, anthropic, openrouter, gemini, deepseek, ollama`
      );
  }
}
