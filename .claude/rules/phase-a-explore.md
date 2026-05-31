# Phase A — Token-Efficient Exploration

Phase A's cost is dominated by **reading snapshots into context**. The snapshot YAML
lives on disk; the expense is pulling it into the model. The discipline below keeps Phase
A cheap without losing the information needed to write `cases.md`.

The goal of Phase A is to map **one target flow**, not to crawl the whole app.

---

## 1. Default to interactive-only snapshots

Use the interactive/actionable-only snapshot while driving a flow — it omits the static
text tree (headings, paragraphs, layout) and returns only the elements you can act on
(buttons, links, inputs, selects):

```
npx playwright-cli snapshot -i
```

(Confirm the exact flag with `npx playwright-cli snapshot --help` for your version.)

Take a **full** snapshot only when you must read static content to write an *assertion*
(e.g. confirming a success message's text), and even then, grep it (rule 2) rather than
reading it whole.

## 2. Grep the snapshot file — never Read it whole

The snapshot YAML can be thousands of lines. **Do not** use the `Read` tool on the whole
file. Use the `Grep` tool (or `grep` via Bash) to pull only the lines you need:

```
# list actionable elements with line numbers
grep -nEi 'button|link|textbox|combobox|checkbox' <snapshot.yaml>

# find one specific element by its accessible name / label
grep -ni '送出' <snapshot.yaml>

# if you need surrounding context, read a bounded window — not the file
sed -n '40,60p' <snapshot.yaml>
```

Only fall back to reading a bounded line range (`Read` with a small `view_range`, or
`sed -n`) around a match. Never load the entire tree.

## 3. Inspect lazily — one inspection per state, only when needed

After each `playwright-cli` action a fresh snapshot is written. **Do not auto-read it.**
Inspect (grep) only when you need to locate the *next* element. Most steps need a single
grep for one element, not a full re-read of the page.

## 4. Cap exploration depth and breadth

- Explore only the steps that belong to the **target flow**. Do not wander into unrelated
  navigation, settings, or sibling features.
- Hard cap per flow: **≤ 12 actionable snapshots** and **≤ 8 distinct page states**. If a
  flow would exceed this, stop and ask the user which path to follow (Clarification
  Protocol) rather than exploring everything.
- One role at a time: finish mapping the flow for one role before switching.

## 5. Extract and discard

The moment you identify the element for a step, write its **stable locator**
(`getByRole` / `getByLabel` / text) into `cases.md` and move on. Do not keep the snapshot
content in working context after you've extracted what you need — the YAML stays on disk
if you need to grep it again.

## 6. Tool choice summary

| Need                                  | Use                                            | Avoid                          |
| ------------------------------------- | ---------------------------------------------- | ------------------------------ |
| Find the next actionable element      | `snapshot -i` + `Grep`                         | full `snapshot` + `Read`       |
| Confirm an assertion's static text    | full `snapshot` + `Grep` for that text         | reading the whole tree         |
| Read around a matched line            | `Read` with a small `view_range` / `sed -n`    | `Read` the entire file         |
| Verify visual state                   | (not needed — never screenshot, see Rule 3)    | `playwright-cli screenshot`    |