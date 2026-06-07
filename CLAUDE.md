# CLAUDE.md

This file is read by Claude Code on session start. It points to `AGENTS.md` for the universal contract and adds Claude-specific overrides.

## Source of Truth

Read `AGENTS.md` first. It contains the stack, workflow, branching, skill routing, governance, agent permissions, and constraints. Everything in this file is a Claude-specific addendum.

## Project Context

This is the Spur Chat Agent - a take-home assignment for a founding engineer role at Spur (spurnow.com). The goal is to demonstrate production-quality architecture: Next.js 16 App Router, AI SDK v6, multi-provider LLM support, streaming chat, Drizzle ORM, and a polished UI with Framer Motion animations.

The project is functionally complete. Current focus is deployment to Vercel + Neon and submission.

## Claude-specific Skill Routing

| User says | Skill |
|---|---|
| "scaffold this repo" | /y-init |
| "follow Yash standards" | the-y-coding-standard |
| "audit governance" | /y-govern |
| "review this PR" | /review |
| "plan a feature" | /plan-eng-review |
| "investigate this bug" | /investigate |
| "ship it" | /ship |
| "weekly retro" | /y-retro |

## Tool Permissions (Claude Code defaults)

Always allowed:
- Read, Write, Edit, Glob, Grep
- Bash: `npm`, `npx`, `git status`, `git diff`, `git log`, `ls`, `find`, `curl`, `docker`

Require prompt:
- Bash: `git push`, `git reset --hard`, `gh pr create`, `vercel deploy`

Always denied without prompt:
- Bash: `rm -rf`, `git push --force`, `sudo`

## Key Files to Know

- `lib/config.ts` - centralized env config via Zod. Only place that reads `process.env`.
- `lib/llm/factory.ts` - multi-provider LLM factory. Add new providers here.
- `lib/repositories/` - all DB access. Route handlers must NOT import Drizzle directly.
- `app/api/chat/route.ts` - main streaming endpoint. Uses AI SDK v6 `toUIMessageStreamResponse()`.
- `components/features/chat/ChatInterface.tsx` - main client component. Uses `useReducer` for state.

## Style

- No em dashes.
- No emojis in code or comments.
- Markdown formatting in prose responses.
- Server Components by default.
- `useReducer` when 3+ related state fields.

## When in Doubt

Defer to `AGENTS.md`. Then to `the-y-coding-standard` references. Then ask the user.
