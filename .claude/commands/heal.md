---
description: "Phase C (heal mode) — alias for /test with heal: forced on. Classify failures, auto-fix locator drift and deterministic waits only, flag real regressions. Never masks a regression."
argument-hint: "[folder]   # tests/generated/<timestamp>; omit to use the latest session"
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# /heal — Phase C in heal mode (alias for /test heal:true)

`/heal` is an **alias for Phase C (`/test`) with `heal:` forced on**. Healing is the opt-in
tail of Phase C, not a separate phase. You are still **Flow-Guard**, a regression guard:
healing **NEVER** makes a failing test pass by hiding broken behavior. You may only
re-resolve drifted selectors and adjust deterministic waits. Everything else is flagged for
a human.

`folder` = `tests/generated/<timestamp>`. If omitted, use the most recent timestamped
folder under `tests/generated/`.

Acknowledge with one line: `heal session: tests/generated/<timestamp>`, then begin.

Execute `/test` (`@.claude/commands/test.md`) with `heal: true`, following
`@.claude/rules/phase-c-heal.md` exactly — it defines the classification decision tree and
the only two edits you are allowed to apply.

---

## Entry shortcut — skip the initial run if results already exist

`/heal`'s value is that it can **consume an existing Phase C run** instead of re-running the
whole suite:

- If this session **already has** a prior Phase C result (`test-results/` contains a JUnit
  XML report **and** the run's traces), **skip Step C2/C3** of `/test` (the initial
  functional run + flake gate) and go straight to the heal tail (Step C4), consuming those
  existing results.
- If **no** prior result exists, run from the start like `/test heal:true` (run → gate →
  heal tail).

---

## Pre-flight Checks

Stop and use the Clarification Protocol if any check fails — do not proceed.

- `flow*.spec.ts` and `playwright.config.ts` must exist for this session and reference valid
  `storageState` paths.
- When consuming existing results: at least one TC must have **failed**. If every TC passed →
  stop and report: `本 session 全部通過,無需 heal。`
- If **all** failures are auth-related (expired `state-{role}.json` / 401 / redirected to
  TSSO login) → do not heal. Stop and instruct: `auth 已過期,請先執行 /reauth 後重跑 /test。`
- Target `baseURL` (from `mock-users.json`) must be reachable before re-exploration.

---

## Steps

Run the heal tail exactly as defined in **Step C4 of `@.claude/commands/test.md`** and the
decision tree in `@.claude/rules/phase-c-heal.md`:

1. **Collect failures** — parse the JUnit XML in `test-results/`, read each failed TC's trace
   for the exact failing locator + expected outcome, cross-reference `cases.md` for the
   step's semantic intent and oracle.
2. **Re-establish ground truth via CLI** — `npx playwright-cli open <baseURL>`, replay login +
   language switch for the role (Core Rule 11 / locale from `cases.md`), navigate to the
   failing step, read the snapshot YAML. Never `npx playwright-cli screenshot`. End with
   `npx playwright-cli close`.
3. **Classify** into exactly one of `DRIFT` · `REGRESSION` · `FLAKE` · `TEST-DEFECT` · `AUTH/ENV`.
4. **Apply allowed edits only** — `DRIFT` → re-resolve to a stable locator; `FLAKE` (wait gap)
   → adjust the wait per `@.claude/rules/dynamic-waits.md`. `REGRESSION` / `TEST-DEFECT` /
   `AUTH/ENV` → **no edit**, flag. Cap **2 heal attempts per TC**, then reclassify
   `REGRESSION (needs human)`. Never write a playwright-cli ref into `spec.ts`.
5. **Verify + final gate** — heal-verify each patched TC 3× (`--repeat-each=3`); accept only
   at 3/3. Then run the **final flake gate** over all now-passing TCs (`--repeat-each=3
   --retries=0`).
6. **Report** the Heal summary table per `@.claude/rules/phase-c-heal.md`, ending with the
   re-run result and every flagged REGRESSION named explicitly.

**Do not** create a new timestamped session — patch in place. The original `spec.ts` is
recoverable via git; additionally write the unified diff of all edits to
`<folder>/heal-<HHMMSS>.patch` for audit.
