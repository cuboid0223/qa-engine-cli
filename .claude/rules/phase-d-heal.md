# Phase D — Heal Rules

Phase D repairs a session's failing tests **without ever masking a regression**.
Flow-Guard is a regression guard: a failing test is a *signal*, and the healer's job
is to tell whether that signal is "the test drifted" (fix it) or "the app broke"
(keep it red and flag it loudly).

---

## The only two edits Phase D may write to `spec.ts`

1. **Selector re-resolution** — replace a drifted locator with a stable locator
   (`getByRole` / `getByLabel` / `getByPlaceholder` / `data-testid`), resolved against
   a **fresh** snapshot YAML captured in this Phase D run.
2. **Wait adjustment** — apply a deterministic wait per `@.claude/rules/dynamic-waits.md`
   when an element provably appears but later than the current wait allows.

**Everything below is forbidden** (each one converts the guard into a regression-hider):

- Changing an assertion's expected value, message, or matcher.
- Deleting or loosening an assertion; converting `expect` to a soft/conditional check.
- Adding `test.skip`, `test.fixme`, `.catch()`, `try/catch` swallowing, or `.first()`
  to dodge a strict-mode violation that signals a real ambiguity.
- Inserting fixed `waitForTimeout` / `sleep` to paper over flakiness.
- Editing auth logic, `playwright.config.ts` projects, or anything under `source:`.

If a fix would require any forbidden edit, the correct action is **flag**, not edit.

---

## Classification decision tree

Run this per failed TC, **after** re-establishing ground truth via `npx playwright-cli`
(login + locale switch for the role, navigate to the failing step, read the snapshot YAML).

```
For the failing step:

1. Did the locator fail to resolve (element-not-found / strict-mode / timeout-on-find)?
   ├─ In the fresh snapshot, is there an element matching the step's SEMANTIC INTENT
   │  (same role + equivalent accessible name / label / purpose from cases.md)?
   │   ├─ Exactly one clear match        → DRIFT        → heal (re-resolve selector)
   │   ├─ No matching element exists      → REGRESSION   → flag (feature removed/broken)
   │   └─ Multiple/low-confidence matches → STOP & ASK   → Clarification Protocol
   └─ (do not look at assertions yet — a missing element is never an assertion fix)

2. Did all locators resolve, but an ASSERTION on the expected end-state failed?
   ├─ Re-running the same flow by hand via CLI, does the app actually produce the
   │  expected end-state (e.g. success toast appears, row count correct)?
   │   ├─ Yes, app is correct, assertion never could have matched the real text/value
   │   │  even on a good build → TEST-DEFECT → flag (generation bug; needs human, no auto-edit)
   │   └─ No, app produces a different/wrong/empty outcome → REGRESSION → flag (DO NOT touch assertion)

3. Mid-flow navigation error, 4xx/5xx page, blank screen, or thrown JS exception?
   → REGRESSION → flag (app broke)

4. Element appears but only after the wait window; or passes on manual retry; or the
   trace shows pending network / animation at the moment of action?
   ├─ Deterministic (always appears, just late: network-idle, spinner, lazy mount)
   │   → FLAKE → heal (wait adjustment only)
   └─ Non-deterministic (sometimes pass, sometimes fail, no clear cause)
       → FLAKE → quarantine + report; no edit

5. 401 / redirect to TSSO login / expired state-{role}.json / target unreachable?
   → AUTH/ENV → defer to /reauth or env fix; no edit
```

**Tie-breaker:** when you cannot confidently distinguish DRIFT from REGRESSION,
default to **REGRESSION + ask**. A false "healed" is far more dangerous than a false
"flagged" — the first ships a broken app silently; the second just asks a human to look.

---

## Heal verification

- A `DRIFT` or `FLAKE` edit is **accepted only if** the patched TC passes 3/3 on
  `--repeat-each=3`. 2/3 or worse → revert the edit, reclassify as `FLAKE` (quarantine)
  or `REGRESSION`, and flag.
- Max **2 heal attempts per TC**. After that, stop and flag as `REGRESSION (needs human)`.
- Healing one TC must not change behavior of a passing TC — after all edits, the whole
  session's previously-passing TCs must still pass. If a heal breaks a green test,
  revert it.

---

## Heal report format

```
## Heal summary — tests/generated/<timestamp>

| TC      | Class        | Action             | Detail                                   |
| ------- | ------------ | ------------------ | ---------------------------------------- |
| TC-001  | DRIFT        | healed             | getByText('送出') → getByRole('button', { name: '提交' }) |
| TC-003  | REGRESSION   | flagged            | 申請後預期 success toast,實際出現「系統錯誤」— 疑似真 bug |
| TC-004  | FLAKE        | healed             | 加 waitForResponse('**/api/leave') 取代固定等待 |
| TC-006  | TEST-DEFECT  | flagged            | 斷言文字在乾淨建置也不符,Phase B 生成錯誤,需人工 |
| TC-007  | AUTH/ENV     | deferred           | state-manager.json 401,請執行 /reauth |

Re-run (healed only, 3×): 2 passed / 0 flaky
Patch: tests/generated/<timestamp>/heal-<HHMMSS>.patch
Regressions flagged: 1 (TC-003) — 需人工確認是否為真實 bug
Full traces: npx playwright show-report
```

A run with any `REGRESSION` row **must not** be reported as green. The exit message
names every flagged regression explicitly — that is the product of the guard.