---
name: plan
description: Phase A — Explore target via npx playwright-cli (Bash/CLI only, never MCP), read source and docs, generate cases.md and save auth state files.
---

# /plan — Phase A: Generate cases.md

You are executing **Phase A**. Your job: understand the flow, discover selectors via playwright-cli snapshots, and produce a human-readable `cases.md` that a QA engineer can review and edit before tests run.

You do NOT generate spec.ts here. You do NOT run tests.

---

## Input

```
target: <url>          # required
source: <dir>          # optional — source code path
docs: <url>            # optional — PRD/spec URL for acceptance criteria
```

---

## Steps

### Step 0 — Load playwright-cli skill

Invoke the playwright-cli skill to load its full command reference and grant browser automation permissions:

```
Skill("playwright-cli")
```

### Step 1 — Set timestamp

Set `<ts>` = current time in `YYYYMMDD-HHMMSS` format. All output goes to `tests/generated/<ts>/`.

### Step 2 — Read docs (if provided)

If `docs` is given, check the format first:

**If `docs` starts with `http://` or `https://` (remote URL):**
1. Run via Bash: `npx playwright-cli open <docs-url>` → playwright-cli auto-outputs a snapshot YAML file path → use `Read` tool to read that YAML file
2. Check the snapshot content: if the page shows a login wall, 403, blank content, or an SSO redirect instead of the actual document — **stop and tell the user**:
   ```
   docs URL 無法存取（可能需要登入或不在內網）。
   請改用本地 markdown 檔案路徑，例如：docs: ./prd.md
   ```
   Do not proceed without docs if docs was provided — the cases will lack acceptance criteria.
3. If accessible, extract:
   - Business invariants
   - State transitions
   - Error messages and their triggers
   - Acceptance criteria per feature

**If `docs` is a local file path (e.g. `./prd.md`, `/path/to/spec.md`):**
1. Read the file directly using the `Read` tool
2. Extract the same items as above (invariants, state transitions, error messages, acceptance criteria)

Format extracted items as a numbered list — these drive case generation directly.

### Step 3 — Read source (if provided)

If `source` is given, read up to 8 files in this priority order:
1. Route/controller files
2. Schema/DTO/validation files
3. Auth/permission files

Extract: all routes, validated fields with constraints, permission checks.

Also look for:
- Role enums or constants (e.g. `MANAGER`, `EMPLOYEE`, `ADMIN`)
- Role-check logic (e.g. `if user.role === 'manager'`)
- Role-switch mechanism: URL params (e.g. `?mockuserid=`, `?role=`) or UI components (role switcher, avatar dropdown)

### Step 3.5 — Mock user resolution

> **CRITICAL**: NEVER use TSSO credentials (`TSSO_USERNAME` / `TSSO_PASSWORD`) for mock user fields. TSSO credentials are for Phase A browser login only. Mock user IDs are separate values.

1. **Check cache**: if `playwright/mock-users.json` exists, read it.
   - Compare `baseURL` in the file with the current `target`.
   - If they **match**: mock mechanism is already known — skip to Step 4.
   - If they **differ**: stop and ask the user:
     ```
     快取的 baseURL 是 <cached baseURL>，但此次 target 是 <target>。
     是否沿用現有的 mock-users.json？（y/n）
     ```
     Wait for confirmation before proceeding. If `n`, treat as if the cache does not exist and continue below.

2. **Determine mechanism** (only if `mock-users.json` does not exist or was rejected):

   a. If the prompt explicitly provides role → mockId mapping (e.g. `manager: mockId=1234`), use those values directly.

   b. If `source:` is provided, grep for mock patterns to determine the mechanism type:
      - URL param: search for `mockId`, `mockuserid`, `impersonat`, `switchRole` in middleware or `getServerSideProps`
      - localStorage: search for `localStorage.setItem` or `sessionStorage.setItem` inside role-switch components
      - API: search for `POST /api/mock` or similar in role-switch handlers

   c. If neither prompt values nor source are available, **ask the user** — do NOT use MCP to discover mock users.

3. **Write `playwright/mock-users.json`** with the resolved mechanism and role→value mapping:

```json
{
  "version": 1,
  "discoveredAt": "YYYY-MM-DD",
  "baseURL": "<target>",
  "roles": {
    "<roleName>": {
      "mechanism": "urlParam",
      "param": "mockId",
      "value": "<id>"
    }
  }
}
```

   Supported `mechanism` values:
   - `"urlParam"` — `playwright-cli goto /?{param}={value}`, server sets cookie
   - `"localStorage"` — `playwright-cli localStorage-set {key} {value}`
   - `"sessionStorage"` — `playwright-cli sessionStorage-set {key} {value}`
   - `"cookie"` — `playwright-cli cookie-add {key} {value}`

### Step 4 — Write cases.md

**REQUIRED: Invoke the `test-cases` skill via the Skill tool. Do not skip, substitute, or inline this step.**

```
Skill("test-cases", args: "target: <target> source: <source> docs: <docs> output: tests/generated/<ts>/cases.md")
```

Pass the same `target`, `source`, `docs`, and the resolved `output` path. The skill handles all playwright-cli exploration, saves auth state files to `playwright/.auth/`, and writes `cases.md` to the output path.

**After the skill completes**, read `tests/generated/<ts>/cases.md` and apply the following additional rules if the flow has role-based branching. Rewrite the file with these additions:

- If the flow has multiple roles with different behaviour, generate one TC per role.
- Each TC is fully self-contained — repeat shared steps in full; do not reference other TCs.
- Add `**Role:** <role>` and `**Precondition:** mocked as <role>` immediately after the TC heading (before **Steps:**).
- Name each TC with the role in the description: `TC-002: Editor 申請假單`.
- Do not add branch metadata (e.g. `Branch-of:`) — clear naming is sufficient.

> **Do NOT record the mock-user injection as a TC step.** Mock setup is pre-baked into `playwright/.auth/state-{role}.json` by Phase A. In each TC, write `**Precondition:** mocked as {role}` in the header instead.

### Step 5 — Summary

```
Phase A complete.
Run: tests/generated/<ts>/
Cases: <N> total

Review and edit cases.md before proceeding:
  tests/generated/<ts>/cases.md

When ready:
  /generate tests/generated/<ts>
```

Do NOT proceed to Phase B. Wait for the user.
