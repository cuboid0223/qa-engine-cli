---
name: reauth
description: Refresh expired TSSO auth state files without touching cases.md or spec.ts. Use when Phase C smoke check reports session expired.
---

# /reauth — Refresh Auth State

You are executing **Auth Refresh**. Your only job is to re-acquire valid TSSO session and rebuild all `playwright/.auth/state*.json` files. You do NOT touch any files under `tests/generated/`, `playwright.config.ts`, or `cases.md`.

---

## Pre-flight Checks

Before doing anything, verify all of the following. If any check fails, stop and tell the user — do not proceed.

1. **`.env` exists** — read it and confirm `TSSO_USERNAME` and `TSSO_PASSWORD` are present and non-empty.
2. **`playwright/mock-users.json` exists** — this file is the source of truth for roles and mechanisms. If it does not exist, `/plan` has never been run; tell the user to run `/plan` first.
3. **Target is reachable** — read `baseURL` from `mock-users.json`. Run a connection check via playwright-cli to confirm the target is up.

---

## Step 1 — Load playwright-cli skill

```
Skill("playwright-cli")
```

---

## Step 2 — Read mock-users.json

Read `playwright/mock-users.json`. Extract:
- `baseURL` — the target URL to navigate to
- `roles` — the full role map (name → mechanism, param, value)

---

## Step 3 — Re-acquire TSSO base session

```bash
npx playwright-cli open <baseURL>
```

Read the snapshot YAML. Check the URL and page content:

- **If redirected to TSSO login** (URL contains `login`, `sso`, `auth`, or snapshot shows username/password fields):
  1. `npx playwright-cli fill <username-ref> "<TSSO_USERNAME>"`
  2. `npx playwright-cli fill <password-ref> "<TSSO_PASSWORD>"`
  3. `npx playwright-cli click <submit-ref>`
  4. Read the new snapshot YAML — confirm the app loaded (not still on login page).
  5. If login failed, stop and tell the user: `⚠️ TSSO 登入失敗，請確認 .env 中的 TSSO_USERNAME / TSSO_PASSWORD 是正確的。`

- **If already on the app** (no redirect):
  1. Proceed directly to saving.

Save the base session:

```bash
npx playwright-cli state-save playwright/.auth/state.json
```

---

## Step 4 — Rebuild per-role auth state

For each role in `mock-users.json`, rebuild its state file using the stored mechanism:

**urlParam mechanism:**
```bash
npx playwright-cli state-load playwright/.auth/state.json
npx playwright-cli goto "/?{param}={value}"
# read snapshot YAML — confirm app loaded (not login redirect)
npx playwright-cli state-save playwright/.auth/state-{role}.json
```

**localStorage mechanism:**
```bash
npx playwright-cli state-load playwright/.auth/state.json
npx playwright-cli goto "/"
npx playwright-cli localStorage-set {key} {value}
npx playwright-cli goto "/"
# read snapshot YAML — confirm app loaded
npx playwright-cli state-save playwright/.auth/state-{role}.json
```

**sessionStorage mechanism:**
```bash
npx playwright-cli state-load playwright/.auth/state.json
npx playwright-cli goto "/"
npx playwright-cli sessionStorage-set {key} {value}
npx playwright-cli goto "/"
# read snapshot YAML — confirm app loaded
npx playwright-cli state-save playwright/.auth/state-{role}.json
```

**cookie mechanism:**
```bash
npx playwright-cli state-load playwright/.auth/state.json
npx playwright-cli cookie-add {key} {value}
npx playwright-cli goto "/"
# read snapshot YAML — confirm app loaded
npx playwright-cli state-save playwright/.auth/state-{role}.json
```

After saving each role file, read the snapshot YAML and confirm the app is loaded (not redirected to login). If any role fails, report it but continue with the remaining roles.

---

## Step 5 — Close and summarize

```bash
npx playwright-cli close
```

Report:

```
✅ Auth 已重新整理

已更新：
  playwright/.auth/state.json
  playwright/.auth/state-{role}.json  (一行一個 role)

下一步：
  /test
```

If any role state failed, list them under `⚠️ 以下 role 重刷失敗：` so the user knows which roles are unavailable.
