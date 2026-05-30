# Test Data Cleanup

Some test cases create persistent data (tasks, records, entries) as part of the flow being validated. When they do, Phase A declares it in the TC's `**Cleanup:**` line in `cases.md` and Phase B generates a `test.afterEach` (or `test.afterAll`) block to clean it up — keeping the environment stable across runs.

**Phase A — annotation rule:** Every TC carries a `**Cleanup:**` line (see `@.claude/rules/cases-template.md`). When a step creates a resource that survives the session and could affect future runs, fill in all five fields:

```
**Cleanup:** resource: task | method: DELETE | endpoint: /api/tasks/{id} | id_from: createdTaskId | scope: afterEach
```

For a read-only flow, the line is exactly `**Cleanup:** none（read-only）`. The line is **never blank**.

**Phase B — consumption rule:** For every TC whose `**Cleanup:**` line is not `none`, emit a `let` variable named after `id_from` to capture the created resource's ID, and a `test.afterEach` (or `test.afterAll`, per `scope`) block that calls the declared `endpoint`/`method` via Playwright's built-in `request` fixture. Substitute `{id}` in `endpoint` with the captured value. The `request` fixture inherits `storageState` from the session config — no auth logic is needed in the spec.

```
test.describe('建立 Task 並確認出現在列表', () => {
  let createdTaskId: string | undefined;        // ← named from id_from

  test.afterEach(async ({ request }) => {        // ← afterAll if scope: afterAll
    if (createdTaskId) {
      await request.delete(`/api/tasks/${createdTaskId}`).catch(() => {});  // ← endpoint/method
      createdTaskId = undefined;
    }
  });

  test('建立 Task 後應出現在列表中', async ({ page }) => {
    const taskName = `Task ${Date.now()}`;
    // ... steps that create the task
    // capture the ID from URL, response body, or page attribute
    createdTaskId = /* extracted ID */;
    await expect(page.getByRole('listitem').filter({ hasText: taskName })).toBeVisible();
  });
});
```

**Rules (enforced):**
- Never omit cleanup for a TC whose `**Cleanup:**` line is not `none`. Leaked test data causes cascading failures in subsequent runs.
- Phase B must **only** use the strategy declared in `**Cleanup:**` — it must not invent an endpoint/method, nor decide on its own that a creating TC needs no cleanup. If a TC creates data but its `**Cleanup:**` is `none` or missing fields, stop and tell the user which TC in `cases.md` to fix.
- Prefer the declared API/DB `endpoint`. Only fall back to UI deletion when `endpoint` is `UI: <locator>` (UI teardown is itself flaky and is the last resort).