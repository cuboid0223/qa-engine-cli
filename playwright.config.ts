import fs from 'node:fs';
import path from 'node:path';
import { createSessionConfig } from './playwright.config.base';

/**
 * playwright.config.ts -- READ-ONLY convenience resolver. No phase may write this file.
 *
 * Bare `npx playwright test` resolves to the MOST RECENT session at load time
 * (computed, not hardcoded) -- so there is no write race between concurrent runs.
 *
 * CI, /test, /heal, /reauth, and any run targeting a SPECIFIC session MUST be explicit:
 *   npx playwright test --config tests/generated/<timestamp>/playwright.config.ts
 *
 * "Latest" is best-effort for local single-run convenience only.
 */

const GEN = path.join(process.cwd(), 'tests', 'generated');

function latestSessionDir(): string {
  const entries = fs
    .readdirSync(GEN, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{8}-\d{6}$/.test(d.name))
    .map((d) => d.name)
    .sort();                                  // timestamp names sort chronologically
  if (!entries.length) {
    throw new Error('No session under tests/generated/. Run /plan or /run first.');
  }
  return path.join(GEN, entries[entries.length - 1]);
}

export default createSessionConfig(latestSessionDir());
