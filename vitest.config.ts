import { defineConfig } from 'vitest/config'
import defaultConfig from './vite.config'

export default defineConfig({
  ...defaultConfig,
  test: {
    globals: true,
    environment: 'node',
    // tests/e2e/*.spec.ts are Playwright browser tests (run via `pnpm test:e2e`), not vitest tests.
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '.github/'],
    },
  },
})
