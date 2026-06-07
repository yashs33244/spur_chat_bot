# AGENTS.md

This file is the universal agent contract for this repository. Every agent surface (Claude Code, Cursor, Codex, Manus, Conductor, CI bots) reads this file first when entering the repo. It defines the stack, workflow, branching, skill routing, governance, permissions, and constraints that every contributor (human or agent) must follow.

## Project Overview

Spur Chat Agent is a production-grade AI live chat support agent built as a take-home assignment for Spur. It provides a multi-channel-ready AI assistant that answers questions about the Spur platform using a streaming LLM backend, persistent conversation history, and a polished Next.js UI. Designed to impress the founding team with architecture quality, not just homework completion.

## Stack

- Language: TypeScript 5.x (strict mode)
- Framework: Next.js 16 App Router (Turbopack)
- Database: PostgreSQL 16 via Drizzle ORM (postgres.js driver). Docker locally, Neon in prod.
- Cache: In-memory sliding-window rate limiter (no Redis required for MVP)
- Deploy target: Vercel Fluid Compute (frontend + API routes)
- AI: Vercel AI SDK v6 (`ai`, `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/react`)
- Multi-provider LLM: openai, openai_compatible, anthropic, openrouter, gemini, deepseek, ollama
- Animation: Framer Motion v12
- Markdown: react-markdown + remark-gfm
- Client data fetching: SWR
- Styling: Tailwind CSS v4

## Quickstart

```bash
git clone <repo-url>
cd spurr-next

npm install

cp .env.local.example .env.local
# Fill in LLM_API_KEY and DATABASE_URL

# Start Postgres (Docker)
docker run -d --name spur-postgres -e POSTGRES_USER=spur -e POSTGRES_PASSWORD=spurdev -e POSTGRES_DB=spurdb -p 5433:5432 postgres:16-alpine

# Run migration
npx drizzle-kit push

# Start dev server
npm run dev

# Type check
npm run build
```

## Repository Layout

```
.
├── AGENTS.md                  # this file. Universal agent contract.
├── CLAUDE.md                  # Claude Code overrides.
├── README.md                  # human-facing project intro.
├── app/                       # Next.js App Router routes
│   ├── layout.tsx             # root layout
│   ├── page.tsx               # home - renders ChatInterface
│   ├── [sessionId]/           # per-session chat page
│   └── api/                   # Route Handlers (chat, conversations)
├── components/
│   ├── ui/                    # presentational primitives (Button, Modal, Input)
│   └── features/              # domain components (chat, sidebar)
├── lib/
│   ├── config.ts              # centralized env via Zod
│   ├── db/                    # Drizzle client + schema
│   ├── llm/                   # LLM factory, prompt builder, types
│   ├── channels/              # ChannelAdapter interface + implementations
│   ├── rate-limiter.ts        # sliding window rate limiter
│   ├── repositories/          # data access layer (conversation, message)
│   └── utils.ts               # cn(), formatDate(), truncate()
├── hooks/                     # client hooks (useConversations, useFollowUp)
├── types/                     # TypeScript type definitions
├── constants/                 # app-wide constants
├── drizzle/                   # SQL migration files
├── Docs/
│   ├── decisions/             # ADRs
│   └── runbooks/              # operational playbooks
├── findings/                  # governance reports
├── plans/                     # feature plans
└── progress/                  # session journals
```

## Workflow

Issue -> Plan -> Implement -> Test -> Review -> Ship -> Retro

1. **Issue**: tracked in GitHub Issues.
2. **Plan**: write `plans/YYYY-MM-DD-<feature>.md`. Run `/plan-eng-review` before coding.
3. **Implement**: TDD where reasonable. Small commits.
4. **Test**: `npm run build` for type check. Vitest for unit tests.
5. **Review**: `/y-review` or external reviewer.
6. **Ship**: `/y-ship` opens the PR.
7. **Retro**: `/y-retro` after significant features.

## Branching

- `main`: protected. PR required.
- `feat/<short-slug>`: feature branches.
- `fix/<short-slug>`: bug fixes.
- `chore/<short-slug>`: non-functional changes.

Commit format: Conventional Commits. Example: `feat(chat): add follow-up question chips`.

## Skill Routing

| User says | Invoke |
|---|---|
| "scaffold this repo" | /y-init |
| "audit governance" | /y-govern |
| "follow standards" | the-y-coding-standard |
| "review this PR" | /review |
| "plan a feature" | /plan-eng-review |
| "ship it" | /ship |
| "investigate this bug" | /investigate |
| "weekly retro" | /y-retro |

## Coding Standards

Follow `the-y-coding-standard` plugin.

Hard rules:

- 400 line file limit (components) / 300 lines preferred (backend).
- Enums, constants, types in separate files.
- Centralized config. Never read `process.env` outside `lib/config.ts`.
- Server Components by default. `'use client'` only at leaf nodes.
- `useReducer` over `useState` when state has 3+ related fields.
- Error handling on every external call (DB, LLM, fetch).
- No em dashes anywhere.
- No emojis in code or comments.
- Repository pattern: all DB access goes through `lib/repositories/`.
- No direct Drizzle calls from Route Handlers or Server Actions.

## LLM Multi-Provider Config

Set `LLM_PROVIDER` in `.env.local` to switch providers. Supported values:
`openai`, `openai_compatible`, `anthropic`, `openrouter`, `gemini`, `deepseek`, `ollama`.

All provider config is in `lib/llm/factory.ts` and `lib/config.ts`. No hardcoded provider logic in route handlers.

## Governance

Run `/y-govern` before every release. Report written to `findings/YYYY-MM-DD-governance.md`.

Required policies:

- No secrets in code.
- Pre-commit hooks enforce lint + type check.
- Branch protection on `main`.
- AI-assisted commits include `Co-Authored-By` line.

## Agent Permissions

| Surface | Read code | Write code | Run tests | Deploy staging | Deploy prod | Access secrets |
|---|---|---|---|---|---|---|
| Claude Code | yes | yes | yes | with approval | NEVER | dev only |
| Cursor | yes | yes | yes | no | NEVER | dev only |
| Codex CLI | yes | review-only | yes | no | NEVER | none |
| CI bot | yes | no | yes | yes | with manual approval | scoped per workflow |

## Constraints

Agents MUST NOT, without explicit human approval:

- Push to remote (`git push`, `git push --force`).
- Run `rm -rf` outside the workspace.
- Run prod migrations.
- Deploy to prod.
- Rotate or read prod secrets.
- Delete branches.
- Commit `.env`, credentials, or any file matching `*secret*` / `*key*`.

## Filing Rules

| Information | Lives in |
|---|---|
| Architecture decisions | `Docs/decisions/` (ADRs) |
| Feature plans | `plans/` |
| Investigation outputs | `findings/` |
| Session journals | `progress/` |
| Runbooks | `Docs/runbooks/` |
| Standards | `AGENTS.md` + linked references |
| Secrets | secret manager only. Never in repo. |

## Ownership

- Owner: Yash Singh
- Contact: itsyash.space
- Last reviewed: 2026-06-07
