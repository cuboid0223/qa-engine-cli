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

**2. Auth state files** — browser sessions for Phase C:
- `playwright/.auth/state.json` — base TSSO session
- `playwright/.auth/state-{role}.json` — one per role (with mock user already injected)

These state files replace `auth.setup.ts` and `mock.{role}.setup.ts`. Phase C loads them directly via `storageState` — no login or mock injection at test runtime.

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
     e. Run `npx playwright-cli state-save playwright/.auth/state.json` — saves TSSO auth for all subsequent test runs
   - If already on the app:
     a. Run `npx playwright-cli state-save playwright/.auth/state.json`
     b. Proceed directly to exploration

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

## After Exploring — Save Per-Role Auth State

After exploration is complete (and before `npx playwright-cli close`), save a state file per role so tests can load each role without repeating mock injection at runtime.

Read `playwright/mock-users.json`. For each role defined there:

**urlParam mechanism:**
```bash
npx playwright-cli state-load playwright/.auth/state.json
npx playwright-cli goto "/?{param}={value}"
# read snapshot YAML — confirm app loaded (not login redirect)
npx playwright-cli state-save playwright/.auth/state-{role}.json
```

**localStorage mechanism:**
```bash
npx playwright-cli state-load playwright/.auth/state.json
npx playwright-cli goto "/"
npx playwright-cli localStorage-set {key} {value}
npx playwright-cli goto "/"
# read snapshot YAML — confirm app loaded
npx playwright-cli state-save playwright/.auth/state-{role}.json
```

**sessionStorage mechanism:**
```bash
npx playwright-cli state-load playwright/.auth/state.json
npx playwright-cli goto "/"
npx playwright-cli sessionStorage-set {key} {value}
npx playwright-cli goto "/"
# read snapshot YAML — confirm app loaded
npx playwright-cli state-save playwright/.auth/state-{role}.json
```

**cookie mechanism:**
```bash
npx playwright-cli state-load playwright/.auth/state.json
npx playwright-cli cookie-add {key} {value}
npx playwright-cli goto "/"
# read snapshot YAML — confirm app loaded
npx playwright-cli state-save playwright/.auth/state-{role}.json
```

If `mock-users.json` does not exist or has no roles, skip this section.

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

Every interactive element **must** have a `→ locator:` line confirmed from playwright-cli stdout or `generate-locator --raw`. Phase B will copy this value verbatim — no derivation.

```markdown
# Flow: <flow name>
Target: <url>
Generated: <ISO-8601>

---

## TC-001: <test case name>

**Steps:**
1. Go to /path
2. Fill <field label>
   → locator: `page.getByRole('textbox', { name: '<label>' })`
3. Click <button label>
   → locator: `page.getByRole('button', { name: '<label>' })`

**Expected Result:**
<concrete outcome — URL change, visible text, element state>

**Assertions:**
- <what to assert> → locator: `page.getByTestId('<testid>')` ← from generate-locator --raw
- <what to assert> → locator: `page.getByRole('heading', { name: '...' })`

**Acceptance Criteria:**
- <criterion from PRD or source validation>
- <criterion>

---
```
