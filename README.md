# Spur Chat Agent

A production-grade AI live chat support agent built for Spur's founding engineer take-home assignment.

See `AGENTS.md` for the full agent contract, stack details, and coding standards.

## What it does

- Real-time streaming AI chat powered by Gemini (or any of 7 supported LLM providers)
- Persistent conversation history in PostgreSQL
- Auto-generated conversation titles (LLM decides the name after the first message)
- Follow-up question suggestions (async, non-blocking)
- Markdown rendering with table, code, and formatting support
- Sidebar with conversation history, inline rename, and delete with confirmation
- In-memory rate limiting (20 req/min per IP)
- Channel-agnostic architecture (ChannelAdapter interface for WhatsApp, Instagram, Facebook)

## Stack

- **Framework**: Next.js 16 App Router (Turbopack)
- **AI**: Vercel AI SDK v6 - multi-provider (openai, anthropic, gemini, openrouter, deepseek, ollama)
- **Database**: PostgreSQL 16 + Drizzle ORM
- **UI**: Tailwind CSS v4 + Framer Motion v12
- **Markdown**: react-markdown + remark-gfm

## Quickstart

```bash
npm install

# Copy and fill in your LLM key and database URL
cp .env.example .env.local

# Start local Postgres
docker run -d --name spur-postgres \
  -e POSTGRES_USER=spur \
  -e POSTGRES_PASSWORD=spurdev \
  -e POSTGRES_DB=spurdb \
  -p 5433:5432 postgres:16-alpine

# Push schema
npx drizzle-kit push

# Run dev server
npm run dev
```

Open http://localhost:3000.

## LLM Providers

Set `LLM_PROVIDER` in `.env.local`. Supported values:

| Provider | Value | Notes |
|---|---|---|
| Google Gemini | `gemini` | Default. Free tier: gemini-3.1-flash-lite |
| OpenAI | `openai` | gpt-4o-mini recommended |
| Anthropic | `anthropic` | claude-3-haiku-20240307 |
| OpenRouter | `openrouter` | 200+ models |
| DeepSeek | `deepseek` | deepseek-chat |
| Ollama | `ollama` | Local models |
| OpenAI-compatible | `openai_compatible` | Any compatible API |

## Deployment

- Frontend + API routes: Vercel
- Database: Neon (serverless Postgres)

See `Docs/runbooks/` for deployment steps.
