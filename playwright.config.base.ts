// @ts-nocheck  — packages installed in CI only; local IDE errors are expected
import * as dotenv from 'dotenv';
dotenv.config();

export const baseConfig = {
  testDir: './tests/generated',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,

  reporter: [
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: process.env.TARGET_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
};
