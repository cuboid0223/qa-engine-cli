---
name: run
description: Full run — Phase A + B + C in sequence. Plan, generate spec.ts, run tests, produce report.
---

# /run — Full Run: Plan + Generate + Test

Runs all three phases in sequence with a mandatory human review pause between Phase A and Phase B.

---

## Input

```
target: <url>
source: <dir>   # optional
docs: <url>     # optional
```

---

## Execution

1. **Phase A** — Execute all steps from `/plan`. Generate `cases.md`.

2. **Pause** — Show the user:
   ```
   Phase A 完成。請確認 cases.md 後再繼續：
     tests/generated/<ts>/cases.md

   確認無誤後輸入 y 繼續執行 Phase B。
   ```
   Wait for user confirmation (`y`) before proceeding. Do NOT skip this pause.

3. **Phase B** — Execute all steps from `/generate`. Generate `flow.spec.ts` from `cases.md`.

4. **Phase C** — Execute all steps from `/test`. Run tests, write report to `reports/`.
