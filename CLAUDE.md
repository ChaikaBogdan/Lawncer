# Lawncer — dev notes

## Testing

- `pnpm test` — vitest unit tests for the engine (`src/**/*.test.ts`). Fast, pure logic, no browser. Run constantly.
- `pnpm test:e2e` — Playwright browser tests (`tests/e2e/*.spec.ts`) that drive the actual rendered game (canvas clicks, AI turns, overwatch reactions) via headless Chromium.
  - **Not** wired into lefthook pre-commit or any CI — deliberately manual only, since they're slow (spin up a dev server + real browser) and some take 20-30s waiting on AI turns.
  - Run them manually after finishing a big feature or milestone, not after every small change.
- `pnpm tsc -p tsconfig.vitest.json --noEmit` type-checks both `src` and `tests` (this is what lefthook's pre-commit type-check hook runs).
