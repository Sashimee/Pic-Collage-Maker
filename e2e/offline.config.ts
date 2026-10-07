import { defineConfig, devices } from '@playwright/test'

/**
 * The offline guarantee needs the service worker, and only the production
 * build has one — the dev server serves modules on demand and registers
 * nothing. So this suite runs against `vite preview` of an existing `dist/`.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'offline.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:4173/Pic-Collage-Maker/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/Pic-Collage-Maker/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
