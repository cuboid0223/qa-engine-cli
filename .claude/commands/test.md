---
name: test
description: Phase C — Smoke-check auth, run spec.ts via Playwright, flake-gate the passing TCs, and (when heal: is enabled) classify failures + heal locator drift / waits. Never masks a regression.
---

# /test — Phase C: Run + Flake Gate (+ optional Heal)

You are executing **Phase C**. Phase C always does **run → flake gate → report**; when
`heal:` is enabled it additionally classifies failures and heals locator drift / waits as
an opt-in tail. Healing **NEVER** makes a failing test pass by hiding broken behavior — see
`@.claude/rules/phase-c-heal.md`.

---

## Input

```
/test tests/generated/YYYYMMDD-HHMMSS
heal: false      # optional — run the heal tail on failures (default false; or process.env.AUTO_HEAL)
gate: true       # optional — run the Stage 2 flake gate (default true; false skips for fast local iteration)
```

Or run without a folder argument — use the most recently modified folder under
`tests/generated/`. Extract `<ts>` from the folder name (e.g.
`tests/generated/20260513-145325` → `<ts>` = `20260513-145325`). Do NOT generate a new
timestamp.

**Entry mode (`/test` vs `/heal` alias):** `/heal` is an alias for this same Phase C with
`heal:` forced on. When invoked as `/heal` **and** this session already has a prior Phase C
result (`test-results/` contains a JUnit XML report **and** traces), **skip Step C2/C3**
(the initial functional run + flake gate) and consume the existing results directly — go
straight to the heal tail (Step C4). Plain `/test` always runs from Step C1.

---

## Step C1 — Smoke check auth state

Before running, verify the auth state is still valid. Read `<folder>/cases.md`, extract the
`target:` URL, then probe via `npx playwright-cli` (login + locale per the session) and read
the snapshot YAML. If the URL contains `keylock`, `login`, or `sso`, the TSSO session has
expired. Stop and tell the user:

```
⚠️ Auth session 已過期，請執行：
  /reauth

完成後再執行 /test 繼續。cases.md 和 spec.ts 不受影響。
```

If the app loads normally, close the session and proceed: `npx playwright-cli close`.

---

## Step C2 — Stage 1: functional run

Always run with the session config (never bare `flow*.spec.ts`):

```bash
npx playwright test --config tests/generated/<ts>/playwright.config.ts
```

Retries and reporters are configured in `playwright.config.base.ts` — do not add
`--reporter` or `--retries` flags here. Print the session first, e.g.
`▶ Running session: tests/generated/<ts>`. Parse the JUnit result into **PASSED** and
**FAILED** sets.

---

## Step C3 — Stage 2: flake gate

Default on; skip only when `gate: false`. Gate the **PASSED** TC ids only (per
`@.claude/rules/flake-gate.md`):

```bash
npx playwright test --config tests/generated/<ts>/playwright.config.ts \
  --repeat-each=3 --retries=0 --grep "<passed TC ids>"
```

Any PASSED TC that does not go 3/3 is reclassified **FLAKY (quarantined)** — write
`tests/generated/<ts>/quarantine.md`. Do **not** re-run FAILED tests here. Classification
so far: `STABLE` (3/3) · `FAILED` · `FLAKY`.

---

## Step C4 — Heal tail (only when `heal:` is enabled)

If `heal:` is **false** / unset, **skip this step entirely** — go to Step C5 and report the
raw pass/fail/flaky result. Do **not** do any CLI re-exploration or classification (that
cost is only paid when healing).

If `heal:` is **true** (or `process.env.AUTO_HEAL === 'true'`) **and** there is at least one
FAILED TC that is not all-auth-related, run the heal tail exactly per
`@.claude/rules/phase-c-heal.md`:

1. **Collect failures** from the JUnit XML + traces in `test-results/`; cross-reference each
   in `cases.md` for semantic intent + the declared expected end-state (oracle).
2. **Re-establish ground truth via CLI** — re-open the app, replay login + locale switch for
   the role, navigate to the failing step, read the fresh snapshot YAML. Never screenshot.
3. **Classify** each failed TC: `DRIFT` · `REGRESSION` · `FLAKE` · `TEST-DEFECT` · `AUTH/ENV`.
4. **Apply allowed edits only** — `DRIFT` → re-resolve to a stable selector; `FLAKE` (wait
   gap) → adjust the deterministic wait. `REGRESSION` / `TEST-DEFECT` / `AUTH/ENV` → **no
   edit**, flag. Cap 2 heal attempts per TC. Never edit assertions, never add skip/sleep/catch.
5. **Heal-verify** each patched TC 3× (`--repeat-each=3`); a heal is accepted only at 3/3.
6. **Final flake gate** — re-run the **whole set of now-passing TCs** (natively-passed +
   healed) with `--repeat-each=3 --retries=0`. A healed TC must clear 3/3 here too; anything
   less is quarantined / reclassified.

Write the unified diff of all edits to `tests/generated/<ts>/heal-<HHMMSS>.patch`. Patch in
place — do not create a new timestamped session.

> **If all failures are auth-related** (expired `state-{role}.json` / 401 / redirect to TSSO):
> do not heal. Stop and instruct `auth 已過期,請先執行 /reauth 後重跑 /test。`

---

## Step C5 — Report

```
✅ <N> STABLE  ❌ <N> FAILED  ⚠️ <N> FLAKY

失敗的 TC：
- TC-003: <name>  →  <error summary>

完整報告（截圖 + trace）：
  npx playwright show-report
```

If the heal tail ran, append the **Heal summary** table from `@.claude/rules/phase-c-heal.md`
(per-TC class / action / oracle / detail, the 3× re-run result, the patch path, and every
flagged REGRESSION named explicitly). A run with any flagged **REGRESSION** is **never**
reported as green.

If the run failed to start entirely (no summary line in stdout), report `❌ 測試未能啟動`
with the pasted stdout/stderr, then stop.
