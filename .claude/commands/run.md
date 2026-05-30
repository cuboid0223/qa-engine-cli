---
name: run
description: Full run — Phase A + B + C in sequence, plus Phase D (heal) when enabled. Plan, generate spec.ts, run tests, show report, optionally self-heal failures.
---

# /run — Full Run: Plan + Generate + Test (+ Heal)

Runs the phases in sequence with a mandatory human review pause between Phase A and Phase B. Phase D runs only when `heal:` is enabled.

---

## Input

```
target: <url>
source: <dir>    # optional — white-box analysis
docs: <url>      # optional — PRD / spec
heal: false      # optional — auto-run Phase D on failures; default false (or process.env.AUTO_HEAL)
```

---

## Execution

1. **Phase A** — Execute all steps from `/plan`. Generate `cases.md` and save auth state files.

2. **Pause** — Show the user:
   ```
   Phase A 完成。請確認 cases.md 後再繼續：
     tests/generated/<ts>/cases.md

   確認無誤後輸入 y 繼續執行 Phase B。
   ```
   Wait for user confirmation (`y`) before proceeding. Do NOT skip this pause.

3. **Phase B** — Execute all steps from `/generate`. Generate `flow.spec.ts` and the session `playwright.config.ts` from `cases.md`.

4. **Phase C** — Execute all steps from `/test`. Smoke-check auth, then run:
   ```
   npx playwright test --config tests/generated/<ts>/playwright.config.ts
   ```
   Show the results summary.

5. **Phase D (conditional)** — After Phase C, **if any TC failed AND (`heal:` is true OR `process.env.AUTO_HEAL === 'true'`)**, run Phase D once per `@.claude/rules/phase-d-heal.md`, then emit a combined report (Phase C results + heal actions).

   - **Non-interactive override (auto mode only):** the healer must NOT block. Any case that `phase-d-heal.md` would "STOP & ASK" on (ambiguous DRIFT vs REGRESSION) is instead classified **REGRESSION** and flagged.
   - Phase D runs **at most once** inside `/run` — never loop.
   - If `heal:` is false / unset, skip Phase D entirely; the run ends at the Phase C summary.

---

## Notes

- A combined report with any flagged **REGRESSION** is never reported as green — name every flagged regression explicitly.
- Phase D edits `spec.ts` in place (selector / wait only) and writes `tests/generated/<ts>/heal-<HHMMSS>.patch`. Review before committing.