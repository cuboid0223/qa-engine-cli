import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * playwright.config.base.ts -- Human-maintained.
 *
 * Exports a factory. Phase B writes a tiny per-session config that calls it, so
 * concurrent /run sessions never clobber a shared config file.
 *
 * Setup chain (enforced by Playwright `dependencies`):
 *   tsso-setup  ->  mock-user-setup  ->  chrome | chrome-<role>
 *
 * Merge your existing base values (timeouts, reporters, etc.) into SHARED.
 */

// ---- Shared defaults (NO `as const` -- it breaks reporter/array typing) -----
export const SHARED = {
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 1,          // enables Playwright flaky detection
  forbidOnly: !!process.env.CI,
  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],
  use: {
    channel: 'chrome',                       // system Chrome; no Chromium install
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
};

type SessionOptions = { locale?: string; baseURL?: string };

/** Read role keys for a session from its mock-users.json. Returns [] for single-role. */
function readRoles(sessionDir: string): string[] {
  try {
    const data = JSON.parse(
      fs.readFileSync(path.join(sessionDir, 'mock-users.json'), 'utf8'),
    );
    return Object.keys(data.roles ?? data.users ?? {});
  } catch {
    return [];
  }
}

/**
 * Build a self-contained config for one session folder.
 * @param sessionDir absolute path to tests/generated/<timestamp>
 * @param opts locale / baseURL (Phase B reads locale from cases.md, baseURL from target)
 */
export function createSessionConfig(sessionDir: string, opts: SessionOptions = {}) {
  const roles = readRoles(sessionDir);
  const multi = roles.length > 1;
  const locale = opts.locale ?? process.env.LOCALE ?? 'zh-TW';
  const baseURL = opts.baseURL ?? process.env.TARGET_URL ?? 'http://localhost:3000';

  const authDir = path.join(sessionDir, '.auth');
  const repoRoot = path.resolve(sessionDir, '..', '..', '..'); // tests/generated/<ts> -> root
  const tssoSetupDir = path.join(repoRoot, 'playwright', 'setup');
  const tssoBase = path.join('playwright', '.auth', 'tsso-base.json'); // global TSSO session

  const common = { ...devices['Desktop Chrome'], locale, baseURL };

  // 1) TSSO login -- runs first, produces playwright/.auth/tsso-base.json
  const tssoSetup = {
    name: 'tsso-setup',
    testDir: tssoSetupDir,
    testMatch: /tsso\.setup\.ts$/,
    use: common,
  };

  // 2) Mock-user switch -- depends on TSSO, starts from tsso-base, produces state(-role).json
  const mockSetup = {
    name: 'mock-user-setup',
    testDir: sessionDir,
    testMatch: /mock-user\.setup\.ts$/,
    dependencies: ['tsso-setup'],
    use: { ...common, storageState: tssoBase },
  };

  // 3) Role test project(s) -- depend on mock-user-setup, use their own state file
  const roleProjects = multi
    ? roles.map((role) => ({
        name: `chrome-${role}`,
        testDir: sessionDir,
        testMatch: new RegExp(`flow\\.${role}\\.spec\\.ts$`),
        dependencies: ['mock-user-setup'],
        use: { ...common, storageState: path.join(authDir, `state-${role}.json`) },
      }))
    : [
        {
          name: 'chrome',
          testDir: sessionDir,
          testMatch: /flow\.spec\.ts$/,
          dependencies: ['mock-user-setup'],
          use: { ...common, storageState: path.join(authDir, 'state.json') },
        },
      ];

  return defineConfig({
    ...SHARED,
    outputDir: path.join(repoRoot, 'test-results'),
    projects: [tssoSetup, mockSetup, ...roleProjects],
  });
}