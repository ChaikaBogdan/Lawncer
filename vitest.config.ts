import { defineConfig } from 'vitest/config'
import defaultConfig from './vite.config'

export default defineConfig({
  ...defaultConfig,
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '.github/'],
    },
  },
})
