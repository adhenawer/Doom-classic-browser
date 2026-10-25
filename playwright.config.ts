import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 90000, workers: 1,
  // Network tracing copies the 399 MB HD response through the inspector,
  // changing WebKit's memory/CPU behavior. Tests keep explicit screenshots,
  // native GPU/audio diagnostics and failure context without recording bodies.
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1180, height: 820 }, trace: 'off' },
  projects: [{name: 'chromium', use: {browserName: 'chromium'}}, {name: 'webkit', use: {browserName: 'webkit'}}],
  webServer: { command: 'npm run preview -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI }
});
