# Generate Stage (Phase B)

Before generating `spec.ts`, read these reference files in order:

1. `.claude/skills/playwright-skill/core/assertions-and-waiting.md`
2. `.claude/skills/playwright-skill/core/forms-and-validation.md`
3. `.claude/skills/playwright-skill/core/flaky-tests.md`
4. `.claude/skills/playwright-skill/core/test-data-management.md`
5. `.claude/skills/playwright-skill/core/locator-strategy.md`
6. `.claude/skills/playwright-skill/core/fixtures-and-hooks.md`

Apply the waiting strategy and assertion patterns defined in those files when writing test structure.

**Test data cleanup:** After reading `cases.md`, for every TC whose `**Cleanup:**` line is not `none`, generate the teardown per `@.claude/rules/test-data-cleanup.md` — a `let` capture variable named from `id_from`, plus a `test.afterEach` / `test.afterAll` (per `scope`) that calls the declared `endpoint` / `method` via the `request` fixture. Use only the declared strategy; never invent one.

**Pattern-based guide loading:**

After reading the static guides above, read `cases.md` and check the top-level `patterns:` field. For each pattern listed, read the corresponding guide(s) before generating:

| Pattern         | Guide(s) to read                                |
| --------------- | ----------------------------------------------- |
| `crud`          | `crud-testing.md`                               |
| `search-filter` | `search-and-filter.md`                          |
| `file-upload`   | `file-upload-download.md`, `file-operations.md` |
| `multi-tab`     | `multi-context-and-popups.md`                   |
| `multi-user`    | `multi-user-and-collaboration.md`               |
| `drag-drop`     | `drag-and-drop.md`                              |
| `websocket`     | `websockets-and-realtime.md`                    |
| `iframe`        | `iframes-and-shadow-dom.md`                     |
| `network-mock`  | `network-mocking.md`, `when-to-mock.md`         |
| `browser-api`   | `browser-apis.md`                               |
| `clock-mock`    | `clock-and-time-mocking.md`                     |

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

| Forbidden                                                | Replace with                                     |
| -------------------------------------------------------- | ------------------------------------------------ |
| `page.waitForTimeout(n)`                                 | `expect(locator).toBeVisible({ timeout: n })`    |
| `locator('.class-name')`                                 | `getByRole()` or `getByLabel()`                  |
| `locator('div > span:nth-child(2)')`                     | filter by text or role                           |
| `locator('//xpath/position[1]')`                         | semantic locator                                 |
| `(await locator.textContent()).toBe(...)`                | `expect(locator).toHaveText(...)`                |
| Hardcoded unique strings (e.g. `'Flow Guard Test Task'`) | Use timestamp suffix: `` `Task ${Date.now()}` `` |

---

## Generating the session config (factory model)

Phase B writes **only** the per-session config at `tests/generated/<timestamp>/playwright.config.ts`. It is a thin call to the factory in the human-maintained `playwright.config.base.ts`.

**Hard rules:**
- **Never write or modify** the root `playwright.config.ts` (read-only resolver) or `playwright.config.base.ts` (the factory). Phase B only writes the file inside the session folder.
- The session config must be **exactly** the factory call below — no inline `projects`, no `...baseConfig` spread, no hand-written `testMatch`. The factory builds the `tsso-setup → mock-user-setup → chrome[-role]` chain from `mock-users.json`.
- All runs target this file via `--config tests/generated/<timestamp>/playwright.config.ts`.

**Session config template (CommonJS — default):**

```ts
import { createSessionConfig } from '../../../playwright.config.base';

export default createSessionConfig(__dirname, {
  locale: 'zh-TW',                       // <- from cases.md `locale:` (see locale rule)
  baseURL: 'http://localhost:3000',      // <- from the run's `target:`
});
```

**If `package.json` has `"type": "module"` (ESM):**

```ts
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createSessionConfig } from '../../../playwright.config.base';

export default createSessionConfig(path.dirname(fileURLToPath(import.meta.url)), {
  locale: 'zh-TW',
  baseURL: 'http://localhost:3000',
});
```

**`locale` rule:** Read the value from the `locale:` field at the top of `cases.md` (written by Phase A) and substitute it into the `locale:` option above. **If `locale:` is absent from `cases.md` frontmatter, stop immediately** — do not default or guess — and tell the user: `cases.md 缺少 locale: 欄位，Phase A 未完整執行，請重新執行 /plan。`

**`baseURL` rule:** Substitute the run's resolved `target:` URL.

**Role / state-file contract (must match what the factory expects):**
- Single-role: the factory builds one `chrome` project using `.auth/state.json`. Phase A's `mock-user.setup.ts` must save to `<session>/.auth/state.json`, and the spec file is `flow.spec.ts`.
- Multi-role: the factory builds one `chrome-{role}` project per key in `mock-users.json`, each using `.auth/state-{role}.json`. `mock-user.setup.ts` must save each role to `<session>/.auth/state-{role}.json`, and spec files are `flow.{role}.spec.ts`.
- The TSSO base session lives at the fixed `playwright/.auth/tsso-base.json`, produced by the `tsso-setup` project. Phase B never writes auth logic into spec files.

---

**Self-review pass:** After generating `spec.ts`, scan every line for non-locator violations (e.g. `page.waitForTimeout`, `(await locator.textContent()).toBe`, hardcoded unique strings). Fix these — they are Phase B's own code structure. If a `locator:` value copied from `cases.md` violates the prohibition list (e.g. `.class-name`, xpath), stop and tell the user which line in `cases.md` to fix — do not silently rewrite it.

Also verify every TC has a `**Cleanup:**` line. If a TC's steps create or mutate persistent state but its `**Cleanup:**` is `none` or missing any of `resource` / `method` / `endpoint` / `id_from` / `scope`, STOP and tell the user which TC in `cases.md` to fix — do not guess a cleanup strategy.

Finally, confirm the session config is the factory call (not an inline config) and that no root `playwright.config.ts` was written.