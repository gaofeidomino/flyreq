import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
    environment: 'node',
    coverage: { provider: 'v8', include: ['packages/*/src/**/*.ts'], exclude: ['packages/*/src/**/*.test.ts'], reporter: ['text', 'json-summary', 'html'] },
  },
})
