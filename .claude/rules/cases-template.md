# cases.md Template

Phase A **must** produce `cases.md` using exactly this structure. Fill in the blanks — no freeform sections, no renamed headings, no extra fields.

````markdown
---
target: {base URL}
locale: {locale}
patterns:
  - {pattern}       # omit entire field if none apply
---

# Flow: {App Name} — {Flow Name}

## TC-001: {動詞}+{受詞}+{預期結果一句話}

**Precondition:** role: {role} | url: {path} | state: {條件描述}

**Steps:**
1. {動作描述}
   locator: page.{locatorMethod}(...)
2. {動作描述}
   locator: page.{locatorMethod}(...)
3. {無需 locator 的步驟，例如純導航}

**Assertions:**
- {斷言描述} [prd]
   locator: page.{locatorMethod}(...)
- {URL 斷言等無 locator 的斷言} [baseline]

**Cleanup:** resource: {資源名} | method: {DELETE} | endpoint: {/api/.../{id}} | id_from: {捕捉 ID 的變數名} | scope: {afterEach | afterAll}

---

## TC-002: {動詞}+{受詞}+{預期結果一句話}

**Precondition:** role: {role} | url: {path} | state: {條件描述}

**Steps:**
1. ...

**Assertions:**
- ... [baseline ⚠ PRD 不符：PRD 寫 {規格說的}]

**Cleanup:** none（read-only）

---
````

**Template rules (enforced — do not deviate):**
- Sections must appear in this exact order: `Precondition` → `Steps` → `Assertions` → `Cleanup`
- Do **not** add `Expected Result` or `Acceptance Criteria` sections
- `locator:` lines are indented **3 spaces** under the step or bullet they belong to
- Steps or assertions that have no locator (e.g. URL navigations, URL checks) omit the `locator:` line entirely — do not write `locator: N/A`
- TC title format: `## TC-{NNN}: {動詞}+{受詞}+{預期結果}` — the title alone must convey what property is being validated
- Each TC block ends with `---`

**Assertion rules (enforced):**
- Every TC must include **at least one outcome assertion** bound to the `{預期結果}` in its title — one that would FAIL if the flow silently did nothing or did the wrong thing. See `@.claude/rules/assertion-strength.md`.
- A "page loaded" check, visibility of an always-present element (nav/logo/header), or asserting an input value right after typing it does **not** satisfy this. Those may appear as intermediate checks, but each TC needs one real consequence check (created item appears, specific success text, status/count/URL change, persistence after reload).
- Every expected value is **observed-only**: it must be what Phase A actually saw on the target, never an unobserved claim copied from a spec.

**Oracle rules (enforced):**
- Every assertion bullet ends with an oracle tag — **`[prd]`** or **`[baseline]`** — placed after the description, before its `locator:` line. The tag is the only oracle marker; there is **no** TC-level oracle field (rollups are computed at report time, e.g. Phase E promote).
- **`[prd]`** — the observed behavior is backed by `docs:` (the spec says this is correct). Carries correctness weight.
- **`[baseline]`** — `docs:` is silent on this behavior. It is a characterization snapshot: it only guarantees the behavior has not changed, not that it is correct. Approving it as correct happens at `/promote` (see `@.claude/rules/phase-e-promote.md`).
- **No `docs:` provided → every assertion is `[baseline]`.** Never tag `[prd]` without a spec statement to back it.
- **Conflict** (`docs:` says X but the target does Y): write the observed Y, tag it `[baseline ⚠ PRD 不符：PRD 寫 X]`. A conflict is a `[baseline]` variant (no separate enum value) and **never blocks Phase A** — it is surfaced for the human at review / promote.

**Cleanup rules (enforced):**
- `Cleanup` is **mandatory** for every TC and is a single pipe-delimited line, same style as `Precondition`.
- A TC that **creates or mutates persistent state** must declare all five fields: `resource` | `method` | `endpoint` | `id_from` | `scope`. These map 1:1 to what Phase B needs to emit the teardown (see `@.claude/rules/test-data-cleanup.md`).
  - `id_from`: the variable name the test will assign the created resource's ID to (e.g. `createdTaskId`).
  - `endpoint`: use `{id}` as the placeholder Phase B substitutes (e.g. `/api/tasks/{id}`).
  - `scope`: `afterEach` (default — per-test isolation) or `afterAll` (only when the whole file deliberately shares fixture data).
- A **read-only** TC must write exactly `**Cleanup:** none（read-only）` — never leave it blank.
- Prefer **API / DB cleanup over UI deletion** (UI teardown is itself a flaky flow). Only use a UI-based `method` when no API path exists; in that case put the deletion locator in `endpoint` as `UI: <locator>`.
- Phase A must resolve the **actual** endpoint/method by **observing the network request** the create step fires (`npx playwright-cli requests` → `npx playwright-cli request <n>` for the POST URL + method; capture the created ID from the response). Derive the `DELETE` endpoint from the observed create endpoint by REST convention. If the DELETE shape cannot be derived cleanly, stop and ask the user (Clarification Protocol) — never a placeholder.
- The `Cleanup` line is **declarative intent**; Phase B generates the real `afterEach`/`afterAll` from it and must not invent a strategy that is not declared here.