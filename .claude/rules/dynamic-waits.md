# Dynamic Element Waits

Some UI elements take time to appear due to debounce, animation, or async loading. The global `expect.timeout` in `playwright.config.base.ts` is set to **10 seconds** as a baseline. For elements known to be slower, Phase A and Phase B share structured wait metadata via `cases.md`.

**Phase A — annotation rule:**
When exploring and a step involves an element that appears after a delay (debounce, transition, async fetch), add a `wait:` field to that step in `cases.md`:

```yaml
- step: "search for user in Dev Tools modal"
  action: fill user-search-input with "editor"
  wait:
    element: user-result-editor
    reason: 1000ms debounce on search input
    timeout: 5000
```

**Phase B — consumption rule:**
For every step in `cases.md` that has a `wait:` field, emit the `{ timeout }` option on the corresponding `expect()` call:

```ts
await page.getByTestId('user-search-input').fill('editor');
await expect(page.getByTestId('user-result-editor'))
  .toBeVisible({ timeout: 5000 }); // 1000ms debounce on search input
```

Never use `page.waitForTimeout()` — always use `expect(..., { timeout })` or Playwright's built-in auto-waiting.

> **Constraint:** The `timeout` value in a `wait:` field is a direct override of the global `expect.timeout` (10000 ms). It must be **greater than 10000** — if set to ≤ 10000, the annotation has no effect and should be removed.
