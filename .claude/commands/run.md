---
name: run
description: Full run — Phase A + B + C in sequence. Plan, generate spec.ts, run tests + flake gate, show report, and optionally self-heal failures (Phase C heal tail) when enabled.
---

# /run — Full Run: Plan + Generate + Test (+ Heal)

Runs the phases in sequence with a mandatory human review pause between Phase A and Phase B. The Phase C heal tail runs only when `heal:` is enabled.

---

## Input

```
target: <url>
docs: <url>      # optional — PRD / spec, used ONLY as an oracle (tag [prd]/[baseline] + flag conflicts)
heal: false      # optional — run the Phase C heal tail on failures; default false (or process.env.AUTO_HEAL)
gate: true       # optional — run the Phase C flake gate; default true (false skips for fast local iteration)
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

4. **Phase C** — Execute all steps from `/test`, passing through `heal:` and `gate:`. Phase C always smoke-checks auth, runs the functional pass, and flake-gates the passing TCs:
   ```
   npx playwright test --config tests/generated/<ts>/playwright.config.ts
   ```
   Then, **if any TC failed AND (`heal:` is true OR `process.env.AUTO_HEAL === 'true'`)**, the Phase C **heal tail** runs once per `@.claude/rules/phase-c-heal.md` and the report combines run results + heal actions. If `heal:` is false / unset, the heal tail is skipped and the run ends at the Phase C summary.

   - **Non-interactive override (auto mode only):** the heal tail must NOT block. Any case that `phase-c-heal.md` would "STOP & ASK" on (ambiguous DRIFT vs REGRESSION) is instead classified **REGRESSION** and flagged.
   - The heal tail runs **at most once** inside `/run` — never loop.

---

## Notes

- A combined report with any flagged **REGRESSION** is never reported as green — name every flagged regression explicitly.
- The heal tail edits `spec.ts` in place (selector / wait only) and writes `tests/generated/<ts>/heal-<HHMMSS>.patch`. Review before committing.
- **Promote is never part of `/run`** — declaring a build's behavior the correct baseline is always a deliberate, manual `/promote` (Phase D).