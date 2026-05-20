import { test as setup, Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { mkdirSync } from 'fs';

dotenv.config();

const authFile = 'playwright/.auth/state.json';
const loginTSSO = async (page: Page) => {
    await page.waitForURL((url) => url.href.includes("keylock"), {timeout: 30000})
    await page.getByLabel("UserName").fill("y_test")
    await page.getByLabel("Password").fill("y_test")
    await page.getByRole("button", {name: "Sign in"}).click()

}


setup('authenticate via TSSO', async ({ page }) => {
  const username = process.env.TSSO_USERNAME;
  const password = process.env.TSSO_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Missing TSSO credentials. Add TSSO_USERNAME and TSSO_PASSWORD to .env'
    );
  }

  mkdirSync('playwright/.auth', { recursive: true });

  // TODO: implement TSSO login flow
  // await page.goto('https://your-tsso-url/login');
  // await page.fill('[name="username"]', username);
  // await page.fill('[name="password"]', password);
  // await page.click('[type="submit"]');
  // await page.waitForURL('**/dashboard**');

  await page.context().storageState({ path: authFile });
});
