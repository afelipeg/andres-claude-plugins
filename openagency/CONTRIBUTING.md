# Contributing to OpenAgency

Thanks for your interest in contributing. Here's how to get started.

## Setup

```bash
git clone https://github.com/openagency/openagency.git
cd openagency
pnpm install
pnpm run build
pnpm run test
```

Requires Node.js >= 18 and pnpm >= 10.

## Project Structure

- `packages/types` — Shared TypeScript interfaces (zero deps)
- `packages/core` — Orchestration, LLM abstraction, math utilities
- `packages/engines` — 4 computation engines (pure functions, no I/O)
- `apps/cli` — CLI application (Commander.js)

## Guidelines

1. **Engines are pure computation.** No I/O, no network calls, no side effects. They must run identically in Node.js and browsers.
2. **LLM is optional.** Every feature must work without an API key. LLM adds narrative on top.
3. **Tests required.** Add tests for new skills. Run `pnpm run test` before submitting.
4. **Types first.** Define interfaces in `@openagency/types` before implementing.
5. **Keep it simple.** Solo marketers are the audience. No enterprise complexity.

## Adding a New Skill

1. Add types to `packages/types/src/<engine>.ts`
2. Implement the computation in `packages/engines/src/<engine>/`
3. Register the skill in the engine's `index.ts`
4. Add tests in `__tests__/`
5. Update README if it's a major feature

## Pull Requests

- Keep PRs focused on one change
- Include tests
- Update types if adding new data structures
- Run `pnpm run build && pnpm run test` before submitting

## Reporting Issues

Open an issue on GitHub with:
- What you expected
- What happened
- Steps to reproduce
- Your Node.js version (`node --version`)
