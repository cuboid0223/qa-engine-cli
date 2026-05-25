---
name: test
description: Phase C — Smoke check auth, run spec.ts via Playwright, show HTML report.
---

# /test — Phase C: Run + Report

You are executing **Phase C**. Verify auth state, run tests, and summarize results.

---

## Input

User provides the run folder:
```
/test tests/generated/YYYYMMDD-HHMMSS
```

Or runs without argument — use the most recently modified folder under `tests/generated/`.

Extract `<ts>` from the folder name (e.g. `tests/generated/20260513-145325` → `<ts>` = `20260513-145325`). Do NOT generate a new timestamp.

---

## Step C1 — Smoke check auth state

Before running tests, verify the auth state is still valid.

Read `<folder>/cases.md` and extract the `Target:` line to get the URL. Then:

```bash
npx playwright-cli state-load playwright/.auth/state.json
npx playwright-cli goto <target-url-from-cases.md>
```

Read the snapshot YAML. If the URL contains `keylock`, `login`, or `sso`, the TSSO session has expired. Stop and tell the user:

```
⚠️ Auth session 已過期，請執行：
  /reauth

完成後再執行 /test 繼續。cases.md 和 spec.ts 不受影響。
```

If the app loads normally, close the session and proceed:

```bash
npx playwright-cli close
```

---

## Step C2 — Run tests

```bash
npx playwright test <folder>/flow*.spec.ts
```

Retries and reporters are configured in `playwright.config.base.ts` — do not add `--reporter` or `--retries` flags.

Capture stdout and stderr from the run.

---

## Step C3 — Report results

Parse the test counts from Playwright stdout (the summary line, e.g. `5 passed (12s)` or `3 failed, 2 passed`).

Tell the user:

```
✅ <N> passed  ❌ <N> failed  ⚠️ <N> flaky

失敗的 TC：
- TC-003: <name>  →  <error summary from stdout>

完整報告（截圖 + trace）：
  npx playwright show-report
```

If the run failed to start entirely (no summary line in stdout), report:

```
❌ 測試未能啟動

<paste stdout/stderr>
```

Then stop.
