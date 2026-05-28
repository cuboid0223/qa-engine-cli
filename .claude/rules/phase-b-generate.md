# Generate Stage (Phase B)

Before generating `spec.ts`, read these reference files in order:
1. `.claude/skills/playwright-skill/core/assertions-and-waiting.md`
2. `.claude/skills/playwright-skill/core/forms-and-validation.md`
3. `.claude/skills/playwright-skill/core/flaky-tests.md`
4. `.claude/skills/playwright-skill/core/test-data-management.md`
5. `.claude/skills/playwright-skill/core/locator-strategy.md`
6. `.claude/skills/playwright-skill/core/fixtures-and-hooks.md`

Apply the waiting strategy and assertion patterns defined in those files when writing test structure.

**Pattern-based guide loading:**

After reading the static guides above, read `cases.md` and check the top-level `patterns:` field. For each pattern listed, read the corresponding guide(s) before generating:

| Pattern | Guide(s) to read |
|---|---|
| `crud` | `crud-testing.md` |
| `search-filter` | `search-and-filter.md` |
| `file-upload` | `file-upload-download.md`, `file-operations.md` |
| `multi-tab` | `multi-context-and-popups.md` |
| `multi-user` | `multi-user-and-collaboration.md` |
| `drag-drop` | `drag-and-drop.md` |
| `websocket` | `websockets-and-realtime.md` |
| `iframe` | `iframes-and-shadow-dom.md` |
| `network-mock` | `network-mocking.md`, `when-to-mock.md` |
| `browser-api` | `browser-apis.md` |
| `clock-mock` | `clock-and-time-mocking.md` |

If `patterns:` is absent or empty, skip this step and proceed with the 6 static guides only.

**Locator quality standard — enforced by Phase A, verified by Phase B:**

`cases.md` `locator:` values (indented under each step or assertion) must conform to this priority order. Phase B copies them verbatim from `cases.md`. If Phase B encounters a `locator:` value that violates the prohibition list below, stop and tell the user which line in `cases.md` to fix — do not silently rewrite it.

**Locator priority (strict — use first that applies):**
1. `getByRole()` — default for interactive elements
2. `getByLabel()` — form inputs
3. `getByText()` — non-interactive content
4. `getByPlaceholder()` — inputs without label
5. `getByAltText()` — images
6. `getByTitle()` — title attribute
7. `getByTestId()` — only when `data-testid` is confirmed present in the source
8. `locator('[attr="value"]')` — stable attribute selectors only (last resort)

**Prohibition list — these patterns must not appear in `spec.ts`:**

| ❌ Forbidden | ✅ Replace with |
|---|---|
| `page.waitForTimeout(n)` | `expect(locator).toBeVisible({ timeout: n })` |
| `locator('.class-name')` | `getByRole()` or `getByLabel()` |
| `locator('div > span:nth-child(2)')` | filter by text or role |
| `locator('//xpath/position[1]')` | semantic locator |
| `(await locator.textContent()).toBe(...)` | `expect(locator).toHaveText(...)` |
| Hardcoded unique strings (e.g. `'Flow Guard Test Task'`) | Use timestamp suffix: `` `Task ${Date.now()}` `` |

**`playwright.config.ts` — `testDir` rule:** The generated config must set `testDir` to `'.'` (repo root). Session scoping is enforced via session-specific `testMatch` regex in each project — not via `testDir`. Never point `testDir` at the session folder or the parent `./tests/generated` directory.

**`playwright.config.ts` — `locale` rule:** The generated config must include `locale` in the top-level `use:` block. Read the value from the `locale:` field at the top of `cases.md` (written by Phase A). **If `locale:` is absent from `cases.md` frontmatter, stop immediately** — do not default or guess — and tell the user: `cases.md 缺少 locale: 欄位，Phase A 未完整執行，請重新執行 /plan。` This acts as a fallback for apps that detect language from the `Accept-Language` header rather than a persistent cookie or profile setting. Write it directly in a `use:` override — do not modify `playwright.config.base.ts`.

**`playwright.config.ts` — `projects` chain rule:** Every generated config — single-role or multi-role — must use a 3-project chain. Never generate a flat single-project config.

**Template note:** `20260520-135959` in the templates below is the example session timestamp. Replace every occurrence with the actual session timestamp from the `cases.md` folder path before writing the config.

**Single-role** (no `Precondition: mocked as` in cases.md):
```ts
export default defineConfig({
  ...baseConfig,
  testDir: '.',
  use: { ...baseConfig.use, locale: 'zh-TW', baseURL: '<target>' },
  projects: [
    { name: 'tsso-setup', testMatch: /playwright[\/\\]setup[\/\\]tsso\.setup\.ts/ },
    {
      name: 'mock-user-setup',
      testMatch: /tests[\/\\]generated[\/\\]20260520-135959[\/\\]mock-user\.setup\.ts/,
      dependencies: ['tsso-setup'],
      use: { storageState: 'playwright/.auth/tsso-base.json' },
    },
    {
      name: 'chrome',
      testMatch: /tests[\/\\]generated[\/\\]20260520-135959[\/\\]flow\.spec\.ts/,
      dependencies: ['mock-user-setup'],
      use: { channel: 'chrome', storageState: 'tests/generated/20260520-135959/.auth/state.json' },
    },
  ],
});
```

**Multi-role** (Phase B emits one `chrome-{role}` project per role — replace the example names with actual role names):
```ts
export default defineConfig({
  ...baseConfig,
  testDir: '.',
  use: { ...baseConfig.use, locale: 'zh-TW', baseURL: '<target>' },
  projects: [
    { name: 'tsso-setup', testMatch: /playwright[\/\\]setup[\/\\]tsso\.setup\.ts/ },
    {
      name: 'mock-user-setup',
      testMatch: /tests[\/\\]generated[\/\\]20260520-135959[\/\\]mock-user\.setup\.ts/,
      dependencies: ['tsso-setup'],
      use: { storageState: 'playwright/.auth/tsso-base.json' },
    },
    {
      name: 'chrome-admin',                       // ← actual role name
      testMatch: /tests[\/\\]generated[\/\\]20260520-135959[\/\\]flow\.admin\.spec\.ts/,
      dependencies: ['mock-user-setup'],
      use: { channel: 'chrome', storageState: 'tests/generated/20260520-135959/.auth/state-admin.json' },
    },
    {
      name: 'chrome-viewer',                      // ← repeat for each additional role
      testMatch: /tests[\/\\]generated[\/\\]20260520-135959[\/\\]flow\.viewer\.spec\.ts/,
      dependencies: ['mock-user-setup'],
      use: { channel: 'chrome', storageState: 'tests/generated/20260520-135959/.auth/state-viewer.json' },
    },
  ],
});
```

**Self-review pass:** After generating `spec.ts`, scan every line for non-locator violations (e.g. `page.waitForTimeout`, `(await locator.textContent()).toBe`, hardcoded unique strings). Fix these — they are Phase B's own code structure. If a `locator:` value copied from `cases.md` violates the prohibition list (e.g. `.class-name`, xpath), stop and tell the user which line in `cases.md` to fix — do not silently rewrite it.
