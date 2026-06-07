# Spur Chat Agent

A production-grade AI live chat support agent built for Spur's founding engineer take-home assignment.

**Live:** https://spurnow.itsyash.space | **GitHub:** https://github.com/yashs33244/spur_chat_bot

## What it does

- Real-time streaming AI chat powered by Gemini (or any of 7 supported LLM providers)
- Persistent conversation history in PostgreSQL
- Auto-generated conversation titles (LLM decides the name after the first message)
- Follow-up question suggestions (async, non-blocking, persisted in DB and restored on reload)
- Markdown rendering with table, code, and formatting support
- Sidebar with conversation history, inline rename, and delete with confirmation
- Two-layer guardrails: pattern-based injection detection + hardened system prompt
- Graceful off-topic handoff (redirects to support team instead of showing an error)
- In-memory rate limiting (20 req/min per IP, configurable)
- Channel-agnostic architecture (ChannelAdapter interface ready for WhatsApp, Instagram, Facebook)

## Stack

- **Framework**: Next.js 16 App Router (Turbopack)
- **AI**: Vercel AI SDK v6 - multi-provider (openai, anthropic, gemini, openrouter, deepseek, ollama)
- **Database**: PostgreSQL 16 + Drizzle ORM
- **UI**: Tailwind CSS v4 + Framer Motion v12
- **Markdown**: react-markdown + remark-gfm
- **Tests**: Jest + ts-jest (23 guardrails unit tests)

## Quickstart

```bash
npm install

# Copy and fill in your keys
cp .env.example .env.local
```

Required variables in `.env.local`:

| Variable | Required | Example |
|---|---|---|
| `DATABASE_URL` | Always | `postgresql://spur:spurdev@localhost:5433/spurdb` |
| `LLM_PROVIDER` | Always | `gemini` |
| `LLM_MODEL` | Always | `gemini-3.1-flash-lite` |
| `LLM_API_KEY` | Always | `AIza...` |
| `MAX_CONTEXT_MESSAGES` | Optional | `20` |
| `MAX_MESSAGE_LENGTH` | Optional | `2000` |
| `RATE_LIMIT_RPM` | Optional | `20` |

```bash
# Start local Postgres
docker run -d --name spur-postgres \
  -e POSTGRES_USER=spur \
  -e POSTGRES_PASSWORD=spurdev \
  -e POSTGRES_DB=spurdb \
  -p 5433:5432 postgres:16-alpine

# Apply schema migrations
psql $DATABASE_URL -f drizzle/0000_initial.sql
psql $DATABASE_URL -f drizzle/0002_add_follow_ups.sql

# Run dev server
npm run dev
```

Open http://localhost:3000.

## Architecture

### Request Flow

```
User message
  -> POST /api/chat
  -> Input validation (Zod schema, empty check, length cap)
  -> Guardrails check (injection detection + off-topic filter)
     -> Blocked: stream graceful handoff message, persist to DB, return 200
  -> Load/create conversation in Postgres
  -> Persist user message
  -> Build system prompt + conversation history
  -> Stream LLM response via AI SDK v6 streamText
  -> onFinish: persist assistant reply, fire-and-forget title generation on first turn
```

### Layer Map

| Layer | Location | Responsibility |
|---|---|---|
| API routes | `app/api/` | HTTP handling, validation, streaming |
| Guardrails | `lib/guardrails.ts` | Injection detection, off-topic filtering |
| LLM factory | `lib/llm/factory.ts` | Provider-swappable model instantiation |
| Prompt builder | `lib/llm/prompt-builder.ts` | System prompt + domain knowledge |
| Repositories | `lib/repositories/` | All Postgres reads/writes via Drizzle ORM |
| Channel adapters | `lib/channels/types.ts` | ChannelAdapter interface for multi-channel |
| Rate limiter | `lib/rate-limiter.ts` | In-memory sliding window per IP |

### Notable Design Decisions

- **Streaming first**: `streamText` + `toUIMessageStreamResponse()` so the first token arrives in ~200ms rather than waiting for the full response.
- **Auto-titling**: After the first message, a fire-and-forget `generateText` call names the conversation without blocking the stream.
- **Provider factory**: Changing `LLM_PROVIDER` in `.env.local` switches providers at runtime with no code changes.
- **Guardrail handoff**: Off-topic and injection attempts return HTTP 200 with a friendly redirect message (not a 400 error) so the chat UI always shows a response.
- **Follow-up persistence**: Generated follow-up chips are stored in the `messages.follow_ups` column and restored when returning to a past session.
- **Client-generated session IDs**: The frontend generates a UUID and silently replaces the URL, enabling shareable conversation links without a redirect.

## LLM Providers

Set `LLM_PROVIDER` in `.env.local`. Supported values:

| Provider | Value | Notes |
|---|---|---|
| Google Gemini | `gemini` | Default. gemini-3.1-flash-lite |
| OpenAI | `openai` | gpt-4o-mini recommended |
| Anthropic | `anthropic` | claude-3-haiku-20240307 |
| OpenRouter | `openrouter` | 200+ models |
| DeepSeek | `deepseek` | deepseek-chat |
| Ollama | `ollama` | Local models, no API key needed |
| OpenAI-compatible | `openai_compatible` | Any compatible endpoint |

### Prompting Strategy

Each request sends: (1) a hardened system prompt establishing the assistant as a Spur-only support agent with embedded FAQ knowledge and explicit injection-resistance rules, (2) the full conversation history for the session loaded from Postgres, (3) the new user message. History is serialized via `convertToModelMessages` from AI SDK v6.

### Token and Cost Assumptions

Default model is `gemini-3.1-flash-lite` (free tier). Estimated ~500 input + ~300 output tokens per turn at current Spur FAQ prompt length. No history truncation is applied - long sessions will approach context limits. Documented as a known trade-off below.

## Running Tests

```bash
npm test
```

23 unit tests covering prompt injection detection and off-topic filtering in `tests/guardrails.test.ts`.

## Deployment

- **Frontend + API routes**: Vercel (`vercel --prod`)
- **Database**: Neon (serverless Postgres, free tier)

Set all variables from `.env.local` as Vercel environment variables, then run migrations against the Neon connection string.

### Web Push Notifications (VAPID)

Generate keys once:

```bash
npx web-push generate-vapid-keys
```

Add to Vercel env vars:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public key (safe to expose - used by browser to subscribe) |
| `VAPID_PRIVATE_KEY` | Private key (server only - signs every push) |
| `VAPID_EMAIL` | Contact email required by the VAPID spec |
| `CRON_SECRET` | Optional random string to protect the cron endpoint |

Apply the push notifications migration:

```bash
psql $DATABASE_URL -f drizzle/0003_push_notifications.sql
```

The Vercel Cron job (`vercel.json`) hits `/api/push/followup` every minute and requires the Pro plan for sub-hourly schedules. On Hobby, upgrade or use an external cron (cron-job.org works free).

## Push Notification Implementation

### What was built

A full server-side Web Push stack with VAPID authentication - the same mechanism Slack, Gmail, and WhatsApp Web use. Notifications reach the user even when the browser tab is closed.

The specific feature: if a conversation goes quiet for 5 minutes after the AI replies, the server sends a push: "Did we resolve your issue? We are here if you need more help." If the user sends another message before the 5-minute window, the follow-up is cancelled.

### Files changed

| File | What changed |
|---|---|
| `public/sw.js` | New. Service worker - receives push events from FCM/APNs, shows the OS notification, handles notification click (focuses existing tab or opens new one) |
| `public/manifest.json` | New. PWA manifest - makes the site installable on Android/iOS Home Screen |
| `hooks/usePushNotifications.ts` | New. Manages permission state, calls `Notification.requestPermission()`, creates a VAPID `PushSubscription` in the browser, POSTs it to the server |
| `app/api/push/subscribe/route.ts` | New. Receives and stores the browser's `PushSubscription` object (endpoint, p256dh key, auth key) keyed by `sessionId` |
| `app/api/push/followup/route.ts` | New. Cron endpoint - queries DB for due follow-ups, signs payload with VAPID private key, sends to FCM/APNs via `web-push` package |
| `lib/repositories/push-subscription.repo.ts` | New. DB helpers: `upsertPushSubscription`, `scheduleFollowUp`, `cancelFollowUp`, `getPendingFollowUps`, `markFollowUpSent` |
| `lib/db/schema.ts` | Added `push_subscriptions` table + `followup_scheduled_at` / `followup_sent` columns on `conversations` |
| `drizzle/0003_push_notifications.sql` | New migration - applied to Neon |
| `app/api/chat/route.ts` | In `onFinish`: calls `scheduleFollowUp(sessionId)`. On new user message: calls `cancelFollowUp(sessionId)` |
| `app/layout.tsx` | Registers the service worker via `afterInteractive` script |
| `vercel.json` | New. Vercel Cron - hits `/api/push/followup` every minute |
| `.env.example` | Documents `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`, `CRON_SECRET` |

### End-to-end flow

```
User sends first message
  -> handleSend fires (user gesture - required by all browsers)
  -> Notification.requestPermission() called
  -> Browser shows native "Allow notifications?" dialog
  -> User clicks Allow

Browser creates PushSubscription
  -> pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
  -> Returns { endpoint: "https://fcm.googleapis.com/...", keys: { p256dh, auth } }
  -> This endpoint is tied to the user's browser on Google/Apple servers

App stores subscription
  -> POST /api/push/subscribe { sessionId, endpoint, p256dh, auth }
  -> Upserted into push_subscriptions table in Neon
  -> Confirmation notification fires immediately: "Notifications enabled"

AI responds to a message
  -> /api/chat onFinish: scheduleFollowUp(sessionId)
  -> Sets conversations.followup_scheduled_at = NOW() + 5 minutes
  -> followup_sent = false

User replies before 5 minutes
  -> cancelFollowUp(sessionId) called on next user message
  -> followup_scheduled_at = NULL, followup_sent = true
  -> No notification sent

User goes quiet / closes the tab
  -> Vercel Cron hits GET /api/push/followup every minute
  -> Queries: conversations JOIN push_subscriptions
             WHERE followup_scheduled_at <= NOW()
             AND followup_sent = false
  -> For each match:
       webpush.sendNotification(
         { endpoint, keys: { p256dh, auth } },
         JSON.stringify({ title, body, url })
       )
       Signs request with VAPID private key
       POSTs encrypted payload to FCM or APNs

Google/Apple relays to device
  -> Service worker (sw.js) wakes up - 'push' event fires
  -> self.registration.showNotification("Spur Support - Quick Check", ...)
  -> OS shows notification even with browser closed

User taps notification
  -> notificationclick event in sw.js
  -> If tab already open: client.focus()
  -> Otherwise: clients.openWindow("/{sessionId}")
```

### Why this needs a service worker

JavaScript in a browser tab stops running when the tab is closed. A service worker is a separate script that runs in the background, registered once per origin, and persists across tab closes (as long as the browser itself is open). It is the only JavaScript context that can:

1. Receive a server-sent push event (`push` listener)
2. Show an OS-level notification (`self.registration.showNotification`)
3. Handle the user tapping that notification (`notificationclick`)

The VAPID private key on the server proves to FCM/APNs that the push came from this specific server, not a rogue third party. The browser verifies this using the VAPID public key it received during subscription.

### The SSR bug that was fixed

`useState` initializers in Next.js client components run during SSR where `Notification` is undefined (Node.js has no Notification API). The hook was initializing permission to `'unsupported'` on the server, and React inherited that value during client hydration. The bell appeared disabled on macOS, Chrome, Firefox - every browser. Fixed by:

1. Starting the initial state at `'default'` (safe neutral value)
2. Using `setTimeout(fn, 0)` inside `useEffect` to detect the real browser permission after hydration, without triggering the `react-hooks/set-state-in-effect` lint rule

### Platform support

| Platform | Works? | Reason |
|---|---|---|
| Chrome / Edge / Firefox (desktop) | Yes | Full Web Push support |
| Android Chrome | Yes | Works even with browser backgrounded |
| macOS Safari 16.1+ | Yes | Apple added Web Push in Safari 16.1 |
| iOS PWA (Add to Home Screen, iOS 16.4+) | Yes | Apple added Web Push for installed PWAs in iOS 16.4 |
| iOS Safari (browser tab) | No | Apple restricts Web Push to installed PWAs only |
| Chrome on iOS | No | Apple requires all iOS browsers to use WebKit - same restriction applies |

For iOS browser users, the app shows a dismissible banner: "Tap Share then Add to Home Screen" - once installed, push works identically to Android.

## Trade-offs and If I Had More Time

### Trade-offs Made

- **In-memory rate limiting**: Zero-dependency and works for single-instance deployments, but resets on every serverless cold start and does not share state across instances. Redis (e.g., Upstash) is the production fix.
- **Full history in every prompt**: Entire conversation history is sent on each turn. Simple to implement and keeps responses contextual, but long conversations approach the model context window limit. A sliding-window or summarization strategy is needed at production scale.
- **No authentication**: Conversations are tied to a client-generated session UUID. Anyone with the URL can view a session. A real deployment needs auth (NextAuth or Clerk).
- **Channel adapters are interface-only**: `lib/channels/types.ts` defines the `ChannelAdapter` contract but only the web chat is wired up. WhatsApp, Instagram, and Facebook adapters are the next logical step.
- **Route path differs from spec**: The spec suggests `/chat/message`; I used `/api/chat` to follow Next.js App Router conventions. Functionally identical.

### If I Had More Time

- Wire actual webhook endpoints for WhatsApp and Instagram using the `ChannelAdapter` interface already defined - the architecture is ready, the adapters just need implementing.
- Move rate limiting to Upstash Redis for stateless serverless scaling.
- Add a `knowledge_gaps` table: when the bot falls back to "I'm not sure", log the query. Surface the top unanswered questions in an admin endpoint. This gives the Spur team a direct feedback loop to improve the FAQ.
- Add context window management - summarize or truncate old turns when approaching token limits.
- Integration tests for API routes against a real test Postgres instance (not just unit tests for the guardrails).
- LLM observability: token usage logging and latency tracking per request.
