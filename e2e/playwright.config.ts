import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  // The Vite dev server compiles on demand, so the first paint of a cold worker
  // can take several seconds — well past Playwright's 5s default.
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:5173/Pic-Collage-Maker/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Escape hatch for environments that already have a Chromium but not the
    // exact build this @playwright/test pins (CI installs its own, so this is
    // normally unset).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/Pic-Collage-Maker/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
