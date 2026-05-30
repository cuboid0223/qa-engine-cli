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
- {斷言描述}
   locator: page.{locatorMethod}(...)
- {URL 斷言等無 locator 的斷言}

**Cleanup:** scope: {afterEach | afterAll | none} | strategy: {API DELETE /api/...  |  UI 刪除  |  狀態重置  |  none（read-only）} | data: {本 TC 建立或改動的資料；唯讀流程填 none}

---

## TC-002: {動詞}+{受詞}+{預期結果一句話}

**Precondition:** role: {role} | url: {path} | state: {條件描述}

**Steps:**
1. ...

**Assertions:**
- ...

**Cleanup:** scope: {afterEach | afterAll | none} | strategy: {...} | data: {...}

---
````

**Template rules (enforced — do not deviate):**
- Sections must appear in this exact order: `Precondition` → `Steps` → `Assertions` → `Cleanup`
- Do **not** add `Expected Result` or `Acceptance Criteria` sections
- `locator:` lines are indented **3 spaces** under the step or bullet they belong to
- Steps or assertions that have no locator (e.g. URL navigations, URL checks) omit the `locator:` line entirely — do not write `locator: N/A`
- TC title format: `## TC-{NNN}: {動詞}+{受詞}+{預期結果}` — the title alone must convey what property is being validated
- Each TC block ends with `---`

**Cleanup rules (enforced):**
- `Cleanup` is **mandatory** for every TC. A read-only flow must write `strategy: none（read-only）` — never leave it blank.
- Prefer **API / DB cleanup over UI deletion**. UI teardown is itself a flaky flow and can pollute the next test. Only fall back to `UI 刪除` when no API/DB path exists.
- When `source:` is provided, Phase A must resolve the **actual cleanup endpoint / mechanism** from the source code and name it explicitly (e.g. `API DELETE /api/leave/{id}`), not a placeholder.
- `scope`: use `afterEach` for per-test isolation (default for any TC that creates data); `afterAll` only when the whole file deliberately shares fixture data; `none` only for read-only TCs.
- The `Cleanup` line is **declarative intent** — Phase B generates the actual `afterEach`/`afterAll` teardown from this field per `@.claude/rules/test-data-cleanup.md`. Phase B must not invent a cleanup strategy that is not declared here.