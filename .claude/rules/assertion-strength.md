# Assertion Strength

A test only guards a flow if its assertions would **fail when the flow breaks**. An
assertion that stays green no matter what the app does is a tautology — it inflates the
pass count while validating nothing. Every TC must carry at least one assertion bound to
its declared end-state (the `{預期結果}` in the TC title).

---

## The core test (apply to every assertion)

> If the flow silently did nothing — or did the wrong thing — would this assertion FAIL?

- **Yes, it would fail** → substantive. Keep it.
- **No, it would still pass** → tautological. Reject it; it does not count toward the TC.

A TC needs at least one assertion that passes the "yes" test. If none do, the TC is not
validating anything.

---

## Required: at least one outcome assertion per TC

The outcome assertion verifies a **consequence** of the flow — something only true *after*
the flow succeeds:

- A created resource appears (`getByRole('listitem').filter({ hasText: newName })`)
- A specific success/confirmation message (assert the **text**, not just visibility of a toast)
- A state change: status field flips, a count increments, an item disappears after delete
- The URL changes to the **specific** expected destination after the action
- A value rendered from the backend (not the value you just typed in)
- Persistence: reload, and the change is still there

The asserted value must originate from the **app's response to the flow**, never be the
literal input echoed back.

---

## Prohibition list — these do NOT count as the outcome assertion

| Weak / tautological pattern                                              | Why it's rejected                               |
| ------------------------------------------------------------------------ | ----------------------------------------------- |
| `expect(page).toHaveURL(/.*/)` / `toContain('')`                         | matches anything — true on any page             |
| `expect(locator).toBeVisible()` on nav / logo / header / always-present  | true on every page, regardless of the flow      |
| `toBeVisible()` on the very element just clicked / the page that loaded  | proves navigation, not the flow's result        |
| `expect(input).toHaveValue('x')` right after `fill('x')`                 | tests Playwright echoing input, not the app     |
| `expect(locator).toBeTruthy()` / asserting a locator object exists       | a locator is always truthy                      |
| Only a page `title` / "page loaded" assertion                            | the Quality Bar's named anti-pattern            |
| Restating the precondition as an assertion                               | true before the flow even ran                   |
| No hard `expect` at all (only `console.log` / soft assertions)           | nothing is enforced                             |

These may still appear as **intermediate** checks within a flow, but they never satisfy
the "at least one outcome assertion" requirement.

---

## Enforcement points

- **Phase A** writes the outcome assertion into each TC's `Assertions` section
  (see `@.claude/rules/cases-template.md`) — the `{預期結果}` in the title must be backed
  by a concrete assertion, not just a navigation/visibility check.
- **Phase B** validates: for every TC, confirm ≥1 assertion passes the core test above.
  If a TC's assertions are all on the prohibition list, **stop and name the TC** — tell the
  user which TC in `cases.md` needs a real outcome assertion. Phase B must not invent one
  (assertions come from `cases.md`), and must not weaken or pad assertions to pass.
- **Phase E (promote)** inherits this: a flow that reached green already passed Phase B's
  assertion check, so no weak-assertion flow enters the committed suite.