import { defineConfig, devices } from '@playwright/test';

// Tests run their own server on 4174 with a FAKE token, so they never use or spend your real key.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4174' },
  webServer: {
    command: 'node server.mjs',
    url: 'http://localhost:4174/day-off-demo.html',
    env: { PORT: '4174', MAP_BLOCK_KEY: 'pk.test-token-not-real', LONGDO_MAP_KEY: 'longdo-test-key-not-real', LONGDO_KEY: '', SEARCH_API_URL: '' },   // no real Longdo calls or search service in tests
    reuseExistingServer: false,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
