import { defineConfig, devices } from '@playwright/test';
import { SHARED } from './playwright.config.base';
import fs from 'node:fs';
import path from 'node:path';

/**
 * playwright.config.e2e.ts -- Human-maintained. The CI / whole-suite config.
 *
 * Runs the committed tests/e2e/ suite with setup SHARED across all flows:
 *   one tsso-setup  +  one mock-user-setup per role  ->  every flow's specs
 *
 * This avoids the O(N) cost of the per-flow `for dir` loop, which re-ran the full
 * tsso + mock-user setup once per flow. Here setup runs once; all flows reuse it,
 * and you get a single HTML report for the whole suite.
 *
 * Assumptions (true for a single app; state them if your case differs):
 *  - Roles are app-global: a role name (e.g. "manager") = the same mock user in every flow.
 *  - A shared `playwright/setup/mock-user.setup.ts` switches to the role given in
 *    `project.metadata.role` and saves `playwright/.auth/state-<role>.json`.
 *  - State files are shared at `playwright/.auth/state-<role>.json` (gitignored).
 *
 * For debugging ONE flow standalone, use that flow's own config instead:
 *   npx playwright test --config tests/e2e/<flow>/playwright.config.ts
 */

const ROOT = process.cwd();
const E2E = path.join(ROOT, 'tests', 'e2e');
const SETUP_DIR = path.join(ROOT, 'playwright', 'setup');
const AUTH = path.join(ROOT, 'playwright', '.auth');
const TSSO_BASE = path.join('playwright', '.auth', 'tsso-base.json');

const locale = process.env.LOCALE || 'zh-TW';
const baseURL = process.env.TARGET_URL || 'http://localhost:3000';
const common = { ...devices['Desktop Chrome'], locale, baseURL };

type Flow = { name: string; dir: string; roles: string[] };

/** Discover committed flows and their roles from tests/e2e/<flow>/mock-users.json. */
function readFlows(): Flow[] {
  if (!fs.existsSync(E2E)) return [];
  return fs
    .readdirSync(E2E, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => {
      const dir = path.join(E2E, d.name);
      let roles: string[] = [];
      try {
        const mu = JSON.parse(fs.readFileSync(path.join(dir, 'mock-users.json'), 'utf8'));
        roles = Object.keys(mu.roles ?? mu.users ?? {});
      } catch {
        /* single-role flow with no registry -> 'default' below */
      }
      return { name: d.name, dir, roles };
    })
    .filter((f) => fs.existsSync(path.join(f.dir, 'cases.md')));
}

const flows = readFlows();
const allRoles = Array.from(
  new Set(flows.flatMap((f) => (f.roles.length ? f.roles : ['default']))),
);

// 1) TSSO login -- runs ONCE for the whole suite
const tssoSetup = {
  name: 'tsso-setup',
  testDir: SETUP_DIR,
  testMatch: /tsso\.setup\.ts$/,
  use: common,
};

// 2) One mock-user-setup per role -- shared setup file reads project.metadata.role
const mockSetups = allRoles.map((role) => ({
  name: `mock-user-setup:${role}`,
  testDir: SETUP_DIR,
  testMatch: /mock-user\.setup\.ts$/,
  dependencies: ['tsso-setup'],
  metadata: { role },
  use: { ...common, storageState: TSSO_BASE },
}));

// 3) One test project per (flow, role) -- all reuse the shared state-<role>.json
const testProjects = flows.flatMap((f) => {
  const roles = f.roles.length ? f.roles : ['default'];
  const multi = roles.length > 1;
  return roles.map((role) => ({
    name: multi ? `${f.name}:${role}` : f.name,
    testDir: f.dir,
    testMatch: multi ? new RegExp(`flow\\.${role}\\.spec\\.ts$`) : /flow\.spec\.ts$/,
    dependencies: [`mock-user-setup:${role}`],
    use: { ...common, storageState: path.join(AUTH, `state-${role}.json`) },
  }));
});

export default defineConfig({
  ...SHARED,
  outputDir: path.join(ROOT, 'test-results'),
  projects: [tssoSetup, ...mockSetups, ...testProjects],
});