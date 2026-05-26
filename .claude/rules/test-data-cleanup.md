# Test Data Cleanup

Some test cases create persistent data (tasks, records, entries) as part of the flow being validated. When they do, Phase A annotates the case in `cases.md` and Phase B generates a `test.afterEach` block to clean up — keeping the environment stable across runs.

**Phase A — annotation rule:**
When a step creates a resource that survives the session and could affect future runs, add a `cleanup:` field to that **case** in `cases.md`:

```yaml
- case: "建立 Task 並確認出現在列表"
  cleanup:
    resource: task
    id_from: createdTaskId
    endpoint: /api/tasks/{id}
    method: DELETE
```

**Phase B — consumption rule:**
For every case in `cases.md` that has a `cleanup:` field, emit a `let` variable to capture the created resource's ID, and a `test.afterEach` block that calls the DELETE endpoint via Playwright's built-in `request` fixture. The `request` fixture inherits `storageState` from `playwright.config.ts` — no additional auth logic is needed in the spec.

```ts
test.describe('建立 Task 並確認出現在列表', () => {
  let createdTaskId: string | undefined;

  test.afterEach(async ({ request }) => {
    if (createdTaskId) {
      await request.delete(`/api/tasks/${createdTaskId}`).catch(() => {});
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

Never omit cleanup for cases annotated with `cleanup:`. Leaked test data causes cascading failures in subsequent runs.
