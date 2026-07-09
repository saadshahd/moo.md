import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/determinism-browser/**'],
    globals: false,
    coverage: { enabled: false },
  },
  resolve: {
    alias: {
      '@worldbox/primitives': '/src/primitives/index.ts',
    },
  },
})
