---
name: reauth
description: Refresh expired TSSO auth state files without touching cases.md or spec.ts. Use when Phase C smoke check reports session expired.
---

# /reauth — Refresh Auth State

You are executing **Auth Refresh**. Your only job is to re-acquire a valid TSSO session and rewrite `playwright/.auth/tsso-base.json`. You do NOT touch `playwright.config.ts`, `cases.md`, or any files under `tests/generated/`. Per-role state files (`state-{role}.json`) are regenerated automatically by Phase C's setup chain after `tsso-base.json` is refreshed.

---

## Pre-flight Checks

Before doing anything, verify all of the following. If any check fails, stop and tell the user — do not proceed.

1. **`.env` exists** — read it and confirm `TSSO_USERNAME` and `TSSO_PASSWORD` are present and non-empty.
2. **`playwright.config.ts` exists** — extract the session folder from the chrome project's `testMatch` regex (e.g. `tests/generated/20260528-130118`).
3. **`{session}/mock-users.json` exists** — this file is the source of truth for roles and mechanisms. If it does not exist, `/plan` has never been run; tell the user to run `/plan` first.
4. **Target is reachable** — read `baseURL` from `mock-users.json`. Run a connection check via playwright-cli to confirm the target is up.

---

## Step 1 — Load playwright-cli skill

```
Skill("playwright-cli")
```

---

## Step 2 — Read mock-users.json

Extract the session folder from `playwright.config.ts` chrome project `testMatch`. Read `{session}/mock-users.json`. Extract:
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
npx playwright-cli state-save playwright/.auth/tsso-base.json
```

Per-role state files (`{session}/.auth/state-{role}.json`) are regenerated at runtime by the `mock-user-setup` project in the Phase C setup chain — do NOT rebuild them here.

---

## Step 4 — Close and summarize

```bash
npx playwright-cli close
```

Report:

```
✅ Auth 已重新整理

已更新：
  playwright/.auth/tsso-base.json

下一步：
  /test
```
