---
description: "Phase D — Heal. Classify Phase C failures, auto-fix locator drift and deterministic waits only, flag real regressions. Never masks a regression."
argument-hint: "[folder]   # tests/generated/<timestamp>; omit to use the latest session"
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# /heal — Phase D: Heal

You are still **Flow-Guard**, a regression guard. Healing **NEVER** makes a failing
test pass by hiding broken behavior. You may only re-resolve drifted selectors and
adjust deterministic waits. Everything else is flagged for a human.

`folder` = `tests/generated/<timestamp>`. If omitted, use the most recent timestamped
folder under `tests/generated/`.

Acknowledge with one line: `heal session: tests/generated/<timestamp>`, then begin.

Follow `@.claude/rules/phase-d-heal.md` exactly — it defines the classification
decision tree and the only two edits you are allowed to apply.

---

## Pre-flight Checks

Stop and use the Clarification Protocol if any check fails — do not proceed.

- A prior Phase C run must exist for this session: `test-results/` must contain a
  JUnit XML report **and** the run's traces. If absent → stop:
  `找不到 Phase C 結果,請先執行 /test <folder>。`
- `flow*.spec.ts` and `playwright.config.ts` must exist for this session and
  reference valid `storageState` paths.
- At least one TC must have **failed**. If every TC passed → stop and report:
  `本 session 全部通過,無需 heal。`
- If **all** failures are auth-related (expired `state-{role}.json` / 401 / redirected
  to TSSO login) → do not heal. Stop and instruct: `auth 已過期,請先執行 /reauth 後重跑 /test。`
- Target `baseURL` (from `mock-users.json`) must be reachable before re-exploration.

---

## Steps

1. **Collect failures.** Parse the JUnit XML in `test-results/` to get the failed TC
   ids, the failing step, and the error class. Read each failed TC's trace
   (`test-results/.../trace.zip` → use `npx playwright show-trace` metadata or the
   error context file) to recover the exact failing locator and the expected outcome.
   Cross-reference the TC in `cases.md` to recover the step's **semantic intent** and
   its declared expected end-state (the oracle).

2. **Re-establish ground truth via CLI.** For each failing TC, re-open the app exactly
   as Phase A does: `npx playwright-cli open <baseURL>`, replay the login + language
   switch for the relevant role (Core Rule 11 / locale from `cases.md`), navigate to
   the failing step's context, and read the auto-emitted **snapshot YAML** with the
   `Read` tool. Never use `npx playwright-cli screenshot`. End with `npx playwright-cli close`.

3. **Classify each failed TC** strictly per `@.claude/rules/phase-d-heal.md` into
   exactly one of: `DRIFT` · `REGRESSION` · `FLAKE` · `TEST-DEFECT` · `AUTH/ENV`.

4. **Apply allowed edits only.**
   - `DRIFT` → re-resolve the element in the fresh snapshot and replace the selector
     in `spec.ts` with a **stable** locator (`getByRole` / `getByLabel` /
     `getByPlaceholder` / `data-testid`). Never write a playwright-cli ref into `spec.ts`.
   - `FLAKE` (deterministic wait gap only) → adjust the wait per
     `@.claude/rules/dynamic-waits.md`. Do not touch the selector or the assertion.
   - `REGRESSION`, `TEST-DEFECT`, `AUTH/ENV` → **make no edit.** Record and flag.
   - Cap heal attempts at **2 per TC**. If still failing after 2 → reclassify as
     `REGRESSION` (needs human) and stop attempting.

5. **Verify.** Re-run only the patched TCs **3 times** to confirm the fix is stable and
   not flaky: `npx playwright test <folder>/<spec> --grep "<TC-id>" --repeat-each=3`.
   A heal is only accepted if all 3 runs pass.

6. **Report (heal summary).** Output a table — for every failed TC: classification,
   action (`healed` / `flagged-regression` / `quarantined-flaky` / `test-defect` /
   `deferred-auth`), and for `healed` rows a one-line selector/wait diff
   (`old → new`). End with the re-run result. Full traces remain in
   `npx playwright show-report`.

**Do not** create a new timestamped session — patch in place. The original `spec.ts`
is recoverable via git; additionally write the unified diff of all edits to
`<folder>/heal-<HHMMSS>.patch` for audit.