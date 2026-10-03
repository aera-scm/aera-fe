import { defineConfig } from '@playwright/test';

// Live reference flow against a deployed environment (WP-8 definition of done). The console
// runs in live mode on the registered callback origin; signed-in browser state comes from
// files outside the repository, so no token is ever stored here.
export default defineConfig({
  testDir: './e2e-live',
  workers: 1,
  retries: 0,
  timeout: 45 * 60_000,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_LIVE_URL ?? 'http://localhost:5173',
    browserName: 'chromium',
    channel: process.env.E2E_BROWSER_CHANNEL,
    viewport: { width: 1366, height: 768 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
