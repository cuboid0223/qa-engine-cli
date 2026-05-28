import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TSSO_USERNAME = process.env.TSSO_USERNAME!;
const TSSO_PASSWORD = process.env.TSSO_PASSWORD!;
const TARGET_URL = process.env.TARGET_URL ?? 'http://localhost:3000';

setup('TSSO login', async ({ page }) => {
  if (!TSSO_USERNAME || !TSSO_PASSWORD) {
    throw new Error('TSSO_USERNAME and TSSO_PASSWORD must be set in .env');
  }

  await page.goto(TARGET_URL);

  // If TSSO redirects to login, complete the login flow.
  // Adjust selectors below to match your TSSO login page.
  if (page.url() !== TARGET_URL && page.url().includes('login') === false) {
    // already authenticated — nothing to do
  } else {
    await page.getByLabel('Username').fill(TSSO_USERNAME);
    await page.getByLabel('Password').fill(TSSO_PASSWORD);
    await page.getByRole('button', { name: /log in|sign in|submit/i }).click();
    await page.waitForURL(TARGET_URL + '**');
  }

  await page.context().storageState({ path: 'playwright/.auth/tsso-base.json' });
});
