import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'on-first-retry',
    locale: 'es-ES',
    // Geolocation stubbed a Plaça Catalunya (BCN) → useGeolocation funziona senza prompt
    geolocation: { latitude: 41.3874, longitude: 2.1686 },
    permissions: ['geolocation'],
  },
  projects: [
    // Pixel 5 = Chromium (~150MB) vs iPhone 13 = WebKit (~600MB).
    // Per smoke test mobile basta uno user-agent + viewport mobile.
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
