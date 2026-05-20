---
name: test
description: Phase C — Run spec.ts via Playwright CLI, produce markdown report.
---

# /test — Phase C: Run + Report

You are executing **Phase C**. Run the generated spec.ts and produce a markdown report.

---

## Input

User provides the run folder:
```
/test tests/generated/YYYYMMDD-HHMMSS
```

Or runs without argument — use the most recently modified folder under `tests/generated/`.

Extract `<ts>` from the folder name (e.g. `tests/generated/20260513-145325` → `<ts>` = `20260513-145325`). Do NOT generate a new timestamp.

---

## Step C1 — Run tests

```bash
npx playwright test <folder>/flow*.spec.ts
```

Retries and reporters are configured in `playwright.config.base.ts` — do not add `--reporter` or `--retries` flags.

Capture stdout and stderr from the run.

---

## Step C2 — Check results file

Before parsing, verify `test-results/results.xml` exists.

If it does **not** exist, the test run failed to start. Write the report as:

```markdown
# QA Report — YYYY-MM-DD HH:MM

Target: <url>
Run: <ts>

## ❌ Run Failed — Tests Did Not Start

<paste Playwright stdout/stderr here>
```

Then stop.

---

## Step C3 — Write report

Output: `reports/report-<ts>.md`

`<ts>` must match the run folder name — never use the current time.

```markdown
# QA Report — YYYY-MM-DD HH:MM

Target: <url>
Run: <ts>

## Summary

| Total | Passed | Failed | Flaky | Duration |
|-------|--------|--------|-------|----------|
| N     | N      | N      | N     | Xs       |

## Results

### ✅ TC-001: <name>
Duration: 1.2s

### ⚠️ TC-002: <name> (flaky — passed on retry)
Duration: 2.1s

### ❌ TC-003: <name>
**Error:** <error message>

**Reproduction:**
\`\`\`typescript
// minimal steps to reproduce
\`\`\`
```

Mark any TC that passed only after retry as ⚠️ (flaky).

Tell the user the report path when done.
