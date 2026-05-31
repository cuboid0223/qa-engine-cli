import { test as setup } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Shared mock-user setup for the aggregated tests/e2e/ suite.
 *
 * Runs once PER ROLE: the role comes from `project.metadata.role`, set by
 * playwright.config.e2e.ts. The project inherits the TSSO base session via
 * `use.storageState`, so the page is already past TSSO login; this file layers
 * the mockUser cookie (+ locale) on top and saves the combined session to
 * playwright/.auth/state-<role>.json, shared by every flow that uses that role.
 *
 * If package.json has "type": "module", replace __dirname with:
 *   import { fileURLToPath } from 'node:url';
 *   const __dirname = path.dirname(fileURLToPath(import.meta.url));
 */

const BASE_URL = process.env.TARGET_URL || 'http://localhost:3000';
const AUTH_DIR = path.resolve(__dirname, '..', '.auth'); // playwright/.auth

setup('configure mock user session', async ({ page }, testInfo) => {
  const role = (testInfo.project.metadata as { role?: string } | undefined)?.role ?? 'default';

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  await page.goto(BASE_URL);

  // Persist zh locale (locale: zh-TW) in localStorage
  await page.evaluate(() => localStorage.setItem('NEXT_LOCALE', 'zh-TW'));

  // Select the mock user for this role (skip the unscoped 'default')
  if (role !== 'default') {
    await page.evaluate((r) => {
      document.cookie = `mockUser=${r}; path=/`;
    }, role);
  }

  await page.context().storageState({ path: path.join(AUTH_DIR, `state-${role}.json`) });
});