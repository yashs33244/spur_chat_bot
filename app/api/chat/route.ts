import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createLLMModel } from '@/lib/llm/factory';
import { buildSystemPrompt } from '@/lib/llm/prompt-builder';
import { checkRateLimit } from '@/lib/rate-limiter';
import { detectInjection, isOffTopic } from '@/lib/guardrails';
import {
  getConversation,
  createConversation,
  updateConversationName,
} from '@/lib/repositories/conversation.repo';
import { persistMessage, countMessages } from '@/lib/repositories/message.repo';
import { scheduleFollowUp, cancelFollowUp } from '@/lib/repositories/push-subscription.repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uiMessagePartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
});

const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(uiMessagePartSchema),
});

const bodySchema = z.object({
  messages: z.array(uiMessageSchema).min(1),
  sessionId: z.string().uuid(),
  id: z.string().optional(),
  trigger: z.string().optional(),
  messageId: z.string().optional(),
});

function extractTextFromParts(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text!)
    .join('');
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rateLimit = checkRateLimit(ip, Number(process.env.RATE_LIMIT_RPM ?? 20));

  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded. Please wait before sending another message.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  const { messages, sessionId } = parsed.data;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return Response.json({ error: 'No user message found' }, { status: 400 });
  }

  const userText = extractTextFromParts(lastUserMessage.parts);
  if (!userText.trim()) {
    return Response.json({ error: 'Message cannot be empty' }, { status: 400 });
  }

  const maxLen = Number(process.env.MAX_MESSAGE_LENGTH ?? 2000);
  if (userText.length > maxLen) {
    return Response.json({ error: 'Message too long' }, { status: 400 });
  }

  if (detectInjection(userText) || isOffTopic(userText)) {
    const handoffText =
      "I'm Spur's support assistant and can only help with questions about Spur's platform. " +
      "For anything else, the Spur team is available at support@spurnow.com or you can book a demo at https://spurnow.com/demo. " +
      "Is there something about Spur I can help you with?";

    await persistMessage(sessionId, 'ai', handoffText).catch(() => {});

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // AI SDK v6 UI message stream format
        controller.enqueue(encoder.encode(`0:${JSON.stringify(handoffText)}\n`));
        controller.enqueue(encoder.encode(`d:${JSON.stringify({ finishReason: 'stop', usage: { promptTokens: 0, completionTokens: 0 } })}\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'x-vercel-ai-data-stream': 'v1',
      },
    });
  }

  let isFirstMessage = false;
  const existing = await getConversation(sessionId);

  if (!existing) {
    await createConversation(sessionId);
    isFirstMessage = true;
  } else {
    const count = await countMessages(sessionId);
    isFirstMessage = count === 0;
  }

  await persistMessage(sessionId, 'user', userText);
  // Cancel any pending follow-up - user is actively chatting
  cancelFollowUp(sessionId).catch(() => {});

  if (isFirstMessage) {
    const nameModel = createLLMModel();
    import('ai')
      .then(({ generateText }) =>
        generateText({
          model: nameModel,
          messages: [
            {
              role: 'user',
              content: `Generate a short (3-5 words) conversation title for a support chat that starts with: "${userText}". Reply with ONLY the title, no quotes, no punctuation at the end.`,
            },
          ],
          maxOutputTokens: 20,
        })
      )
      .then(async (result) => {
        const name = result.text.trim().slice(0, 60);
        if (name) await updateConversationName(sessionId, name);
      })
      .catch(() => {});
  }

  const model = createLLMModel();
  const modelMessages = await convertToModelMessages(messages as unknown as UIMessage[]);

  const result = streamText({
    model,
    system: buildSystemPrompt(),
    messages: modelMessages,
    onFinish: async ({ text }) => {
      await persistMessage(sessionId, 'ai', text);
      // Schedule a follow-up push in 5 minutes. If the user sends another
      // message before then, cancelFollowUp() above will reset it.
      scheduleFollowUp(sessionId).catch(() => {});
    },
  });

  return result.toUIMessageStreamResponse();
}
