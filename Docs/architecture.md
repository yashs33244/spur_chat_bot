# Architecture

## Overview

```
Browser
  |
  | HTTP / SSE
  v
Next.js App Router (Vercel Fluid Compute)
  |--- app/page.tsx                  (Server Component - renders ChatInterface)
  |--- app/[sessionId]/page.tsx      (Server Component - hydrates messages from DB)
  |--- app/api/chat/route.ts         (Route Handler - streams LLM response)
  |--- app/api/conversations/*       (Route Handlers - CRUD)
  |
  |--- lib/llm/factory.ts            (multi-provider LLM factory)
  |--- lib/repositories/             (data access layer)
  |--- lib/db/                       (Drizzle + postgres.js)
  |
  v
PostgreSQL (Docker locally / Neon in prod)
```

## Key Decisions

See `Docs/decisions/` for ADRs.

| Decision | Choice | Reason |
|---|---|---|
| LLM library | AI SDK v6 | Provider-agnostic, streaming built-in |
| Multi-provider | factory pattern | Swap providers via env var, no code change |
| Streaming format | toUIMessageStreamResponse() | AI SDK v6 native, pairs with useChat |
| DB ORM | Drizzle | SQL-first, lightweight, TypeScript-native |
| Client state | useReducer | 4+ related state fields in ChatInterface |
| Conversation list | SWR polling | Simple, no WebSocket needed |
| Follow-up questions | async POST after stream ends | Non-blocking, enhances UX |

## Data Flow - Chat Message

1. User types message in InputBar
2. `sendMessage({ text })` called on `useChat` hook
3. `DefaultChatTransport` POSTs `{ messages: UIMessage[], sessionId }` to `/api/chat`
4. Route handler validates, persists user message, calls `streamText()`
5. `toUIMessageStreamResponse()` streams SSE back to client
6. `useChat` updates `messages` state in real time
7. `onFinish` callback triggers follow-up question fetch + conversation list refresh
8. Async: LLM generates conversation name, DB updated
