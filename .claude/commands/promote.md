---
name: promote
description: Phase E — Promote. Flake-gate an approved session and copy it into the committed tests/e2e/ regression suite. Only promotes a 3/3-green flow; never promotes a failing or flaky one.
argument-hint: "[folder]   # tests/generated/<timestamp>; omit to use the latest session"
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# /promote — Phase E: Promote to the committed regression suite

Move an approved, green, non-flaky session out of the ephemeral `tests/generated/`
(gitignored) into the version-controlled `tests/e2e/` suite. This is what makes
Flow-Guard a **regression guard** rather than a change-detector: only the committed
suite is re-run later to catch behavior changes.

`folder` = `tests/generated/<timestamp>`. If omitted, use the most recent session.

Acknowledge with one line: `promote session: tests/generated/<timestamp>`, then begin.

Follow `@.claude/rules/phase-e-promote.md` exactly.

---

## Pre-flight Checks

Stop and use the Clarification Protocol if any fails — do not promote.

- The session must have already passed Phase C **green** (every TC passed). If Phase C
  has not run, or has any failure, stop: `本 session 尚未全綠，請先 /test（必要時 /heal）通過後再 promote。`
- `flow*.spec.ts`, `playwright.config.ts`, `mock-user.setup.ts`, and `mock-users.json`
  must exist in the session folder.
- `cases.md` must have a `# Flow: ...` heading — it is the source of the flow slug. If
  absent/ambiguous, stop and ask for the slug.

---

## Steps

1. **Flake gate (non-negotiable).** Run the passing TCs 3× with retries off and require
   all green (per `@.claude/rules/flake-gate.md`):
   ```
   npx playwright test --config tests/generated/<ts>/playwright.config.ts --repeat-each=3 --retries=0
   ```
   If any run fails or flakes, **abort promotion** and report which TC was unstable.
   A flaky test must never enter the committed suite.

2. **Resolve the flow slug** from the `# Flow:` heading per `@.claude/rules/phase-e-promote.md`.
   If `tests/e2e/<slug>/` already exists, this is an **update (re-promotion)** — proceed,
   and note that `git diff` will show exactly what validated behavior changed.

3. **Copy the approved artifacts** into `tests/e2e/<slug>/` (overwrite on update):
   `cases.md`, every `flow*.spec.ts`, `mock-user.setup.ts`, `mock-users.json`.
   **Never copy `.auth/` state files** — those stay generated-at-runtime and gitignored.

4. **Write the committed config** `tests/e2e/<slug>/playwright.config.ts` as the factory
   call (CJS or ESM per `package.json`), substituting the same `locale`/`baseURL` the
   session used.

5. **Stamp provenance** at the top of `tests/e2e/<slug>/cases.md` (or a `PROVENANCE` file):
   source session timestamp + target app version/commit if recorded in session metadata.

6. **Ensure `.gitignore`** contains `tests/e2e/*/.auth/` (commit specs + cases, never auth state).

7. **Report.** What was promoted, new-flow vs update, the flake-gate result (3/3), and a
   reminder to commit. For an update, print a 1-line summary of the cases.md diff.

---

## Hard rules

- Never promote a flow that is not 3/3 green. The gate is the whole point.
- Never modify the source session — promotion is a read-only copy outward.
- Promotion overwrites the committed flow wholesale; rely on git for history and surface
  the diff. Do not try to merge.