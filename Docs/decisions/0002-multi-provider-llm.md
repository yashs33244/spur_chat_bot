# ADR 0002: Multi-provider LLM via factory pattern

Date: 2026-06-07
Status: Accepted

## Context

The assignment requires supporting multiple LLM providers. Hardcoding a single provider makes the system brittle and limits testability.

## Decision

Implement a `createLLMModel()` factory in `lib/llm/factory.ts` that reads `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, and `LLM_API_BASE` from the centralized config and returns an AI SDK v6 compatible model instance. Providers are selected via a switch statement. All caller code is provider-agnostic.

## Consequences

- Adding a new provider requires only a new case in the switch and an `@ai-sdk/<provider>` package.
- All route handlers remain unchanged when switching providers.
- The .env.local file is the single control point for provider selection.

## Alternatives considered

- Separate route handlers per provider: rejected - too much duplication.
- Runtime provider registry: rejected - over-engineered for this use case.
