# Cursor Style Rules

Read AGENTS.md first. All coding standards, branching rules, and architecture decisions live there.

## Quick reference

- Server Components by default. `'use client'` only at leaf nodes.
- No `process.env` outside `lib/config.ts`.
- Repository pattern: all DB access through `lib/repositories/`.
- `useReducer` when 3+ related state fields.
- 400 line hard limit per file.
- No em dashes. No emojis in code.
