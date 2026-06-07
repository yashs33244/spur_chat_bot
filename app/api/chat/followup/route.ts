import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createLLMModel } from '@/lib/llm/factory';
import { updateLastAiMessageFollowUps } from '@/lib/repositories/message.repo';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { lastAiMessage, userMessage, sessionId } = await req.json();
    if (!lastAiMessage) return NextResponse.json({ questions: [] });

    const model = createLLMModel();
    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: `Based on this support conversation:
User: ${userMessage}
AI: ${lastAiMessage}

Generate exactly 3 short follow-up questions a user might ask next. Return ONLY a JSON array of strings, no explanation. Example: ["What are the pricing plans?", "How do I get started?", "Is there a free trial?"]`,
        },
      ],
      maxOutputTokens: 150,
    });

    let questions: string[] = [];
    try {
      const text = result.text.trim();
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        questions = JSON.parse(match[0]);
      }
    } catch {
      questions = [];
    }

    const finalQuestions = questions.slice(0, 3);

    if (sessionId && finalQuestions.length > 0) {
      try {
        await updateLastAiMessageFollowUps(sessionId, finalQuestions);
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ questions: finalQuestions });
  } catch {
    return NextResponse.json({ questions: [] });
  }
}
