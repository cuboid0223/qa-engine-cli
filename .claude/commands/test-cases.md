---
name: test-cases
description: Generate human-readable test cases for a user flow by exploring the target via npx playwright-cli (Bash/CLI only, never MCP) and extracting acceptance criteria from source and docs.
---

# Test Cases Skill

## Goal

This skill produces two things:

**1. `cases.md`** — human-readable test cases:
- Editable by a QA engineer before tests run
- Covers the complete flow from start to expected end state
- Has concrete acceptance criteria (from PRD docs when provided)
- Includes confirmed stable Playwright locators for every interactive element

If `output:` is provided in args, write `cases.md` to that exact path. Otherwise default to `tests/generated/cases.md`.

**2. Auth setup artifacts** — enable Phase C's setup chain:
- `playwright/.auth/tsso-base.json` — TSSO session only (loaded by mock-user-setup project)
- `playwright/setup/mock-user.setup.ts` — generated setup script; injects mock user per role and saves `state-{role}.json` at test runtime

Phase C runs these via a 3-project chain: `tsso-setup → mock-user-setup → chromium-{role}`. Role auth state files are created fresh on each Phase C run, not baked in during Phase A.

---

## Before Exploring — Load playwright-cli skill

Invoke the playwright-cli skill to load its full command reference and grant browser automation permissions:

```
Skill("playwright-cli")
```

---

## Before Exploring — Establish Auth Session

Before navigating any app pages, check for TSSO authentication:

1. Run `npx playwright-cli open <target>` via Bash — opens browser and navigates in one step. After each command, playwright-cli automatically outputs a snapshot file path (e.g. `.playwright-cli/page-*.yml`). Use the `Read` tool to read that YAML file and inspect the current page state.
2. Read the snapshot YAML — check page URL and element refs:
   - If redirected to a TSSO login page (URL contains `login`, `sso`, `auth`, or snapshot shows username/password fields):
     a. Run `npx playwright-cli fill <ref> "<TSSO_USERNAME from .env>"` for the username field
     b. Run `npx playwright-cli fill <ref> "<TSSO_PASSWORD from .env>"` for the password field
     c. Run `npx playwright-cli click <submit-ref>` → read the new snapshot YAML
     d. Confirm the app is accessible (not still on login page)
     e. **Switch language before state-save:** Read the current snapshot YAML and look for an i18n / language switcher element. Click to select the `locale:` value (from args, default `zh-TW`). Read the resulting snapshot to confirm the switch succeeded. If no switcher is found, print `⚠ 找不到語言切換器，將僅依賴 use.locale: {locale}` and continue.
     f. Run `npx playwright-cli state-save playwright/.auth/tsso-base.json` — saves TSSO session (with language preference) as input for the mock-user-setup chain
   - If already on the app:
     a. **Switch language before state-save:** same as step (e) above.
     b. Run `npx playwright-cli state-save playwright/.auth/tsso-base.json`
     c. Proceed directly to exploration

Run `npx playwright-cli close` when exploration is complete.

Do not proceed with exploration if authentication fails.

---

## What to Explore

For each page in the flow:
1. Navigate via Bash: `npx playwright-cli goto <url>` — playwright-cli auto-captures a snapshot after each command and outputs the YAML file path
2. Use the `Read` tool to read the snapshot YAML file — discover interactive elements from the `ref` values in the YAML
3. Record all interactive elements with their refs:
   - Input fields: ref, label, placeholder
   - Buttons: ref, visible text
   - Links: ref, text, href
   - Dropdowns: ref, current value, options
4. Note any visible validation messages or error states
5. To interact: `npx playwright-cli click <ref>`, `npx playwright-cli fill <ref> "<text>"` — each command auto-outputs a new snapshot YAML path; read it to see the result. **The Bash stdout also contains the generated Playwright code (e.g. `await page.getByRole('button', { name: 'Submit' }).click()`). Capture this line for every action — it is the confirmed stable locator.**
6. For elements you only observe but never click/fill (assertion targets such as result banners, role badges, error messages): run `npx playwright-cli generate-locator <ref> --raw` immediately after the snapshot, before navigating away. Record the output as the stable locator for that element.

**Budget**: max 8 navigations total (including the initial auth navigation). This applies to exploration only — per-role state-saves in the next section are not counted.

## After Exploring — Generate mock-user.setup.ts

After exploration is complete (and before `npx playwright-cli close`), generate `playwright/setup/mock-user.setup.ts` from the mechanism recorded in `playwright/mock-users.json`.

This file is the Phase C setup chain's second project. It receives the TSSO base session via `storageState` (injected by `playwright.config.ts`) and saves one `state-{role}.json` per role.

If `mock-users.json` does not exist or has no roles, skip this section.

**urlParam mechanism — template:**
```ts
import { test as setup } from '@playwright/test';

// AUTO-GENERATED by Flow-Guard /plan — do not edit by hand.
setup.describe('mock user setup', () => {
  setup('setup: {role}', async ({ page }) => {
    await page.goto('/?{param}={value}');
    await page.context().storageState({ path: 'playwright/.auth/state-{role}.json' });
  });
  // repeat for each role
});
```

**localStorage mechanism — template:**
```ts
import { test as setup } from '@playwright/test';

// AUTO-GENERATED by Flow-Guard /plan — do not edit by hand.
setup.describe('mock user setup', () => {
  setup('setup: {role}', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('{key}', '{value}'));
    await page.reload();
    await page.context().storageState({ path: 'playwright/.auth/state-{role}.json' });
  });
  // repeat for each role
});
```

**sessionStorage mechanism — template:**
```ts
import { test as setup } from '@playwright/test';

// AUTO-GENERATED by Flow-Guard /plan — do not edit by hand.
setup.describe('mock user setup', () => {
  setup('setup: {role}', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('{key}', '{value}'));
    await page.reload();
    await page.context().storageState({ path: 'playwright/.auth/state-{role}.json' });
  });
  // repeat for each role
});
```

**cookie mechanism — template:**
```ts
import { test as setup } from '@playwright/test';

// AUTO-GENERATED by Flow-Guard /plan — do not edit by hand.
setup.describe('mock user setup', () => {
  setup('setup: {role}', async ({ page }) => {
    await page.context().addCookies([{
      name: '{key}',
      value: '{value}',
      url: '{baseURL}',
    }]);
    await page.goto('/');
    await page.context().storageState({ path: 'playwright/.auth/state-{role}.json' });
  });
  // repeat for each role
});
```

Fill in `{param}`, `{value}`, `{key}`, `{baseURL}`, and `{role}` from `mock-users.json`. Generate one `setup(...)` block per role. Write the result to `playwright/setup/mock-user.setup.ts`.

## Cases to always generate

| Type | What to test |
|------|-------------|
| Happy path | Complete flow with valid inputs → expect success state |
| Required field validation | Submit with empty required fields → expect error messages |
| Navigation | Each step correctly navigates to the next page |
| End state | Final page/state matches expected outcome from PRD |

If `source` is provided, also add:
- Boundary cases for validated fields (min/max length, format constraints)
- Permission checks for protected routes

If `docs` is provided:
- One case per business invariant extracted from the PRD
- Cases for every error message defined in the spec
- Cases for every state transition described

## cases.md format

Write `cases.md` using exactly the structure from `.claude/rules/cases-template.md`. The YAML frontmatter is **required** — write it first, before any TC blocks.

Every interactive element **must** have a `locator:` line (3-space indent) confirmed from playwright-cli stdout or `generate-locator --raw`. Phase B will copy this value verbatim — no derivation.

```markdown
---
target: <url>
locale: <locale>        ← required — write the resolved locale value (e.g. zh-TW)
patterns:
  - <pattern>           ← omit entire field if none apply
---

# Flow: <App Name> — <Flow Name>

## TC-001: <動詞>+<受詞>+<預期結果一句話>

**Precondition:** role: <role> | url: <path> | state: <條件描述>

**Steps:**
1. Go to /path
2. Fill <field label>
   locator: page.getByRole('textbox', { name: '<label>' })
3. Click <button label>
   locator: page.getByRole('button', { name: '<label>' })

**Assertions:**
- <what to assert>
   locator: page.getByTestId('<testid>')
- <URL check or assertion without locator>

---
```

Do **not** add `Expected Result:` or `Acceptance Criteria:` sections — these are forbidden by the template.
