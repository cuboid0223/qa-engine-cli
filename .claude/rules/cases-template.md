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

---

## TC-002: {動詞}+{受詞}+{預期結果一句話}

**Precondition:** role: {role} | url: {path} | state: {條件描述}

**Steps:**
1. ...

**Assertions:**
- ...

---
````

**Template rules (enforced — do not deviate):**
- Sections must appear in this exact order: `Precondition` → `Steps` → `Assertions`
- Do **not** add `Expected Result` or `Acceptance Criteria` sections
- `locator:` lines are indented **3 spaces** under the step or bullet they belong to
- Steps or assertions that have no locator (e.g. URL navigations, URL checks) omit the `locator:` line entirely — do not write `locator: N/A`
- TC title format: `## TC-{NNN}: {動詞}+{受詞}+{預期結果}` — the title alone must convey what property is being validated
- Each TC block ends with `---`
