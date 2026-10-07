import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**', 'src/test-setup.ts', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'html'],
      // Today's numbers, floored. Ratchet up as coverage grows; never lower.
      thresholds: { statements: 23, branches: 23, functions: 20, lines: 24 },
    },
  },
})
