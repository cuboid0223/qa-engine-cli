# Phase D — Promote Rules

Promotion turns an approved session into a permanent, version-controlled regression
test. The committed `tests/e2e/` suite is the only thing that gives Flow-Guard a real
baseline: it is re-run unchanged on later builds, so a failure means **the app changed**,
not that the AI generated a different test this time.

---

## Flow slug

Derive the folder name from the `# Flow: {App} — {Flow Name}` heading in `cases.md`:
slugify the `{Flow Name}` part — lowercase, spaces/punctuation → hyphens, ASCII where
possible (e.g. `請假申請` → `leave-request` if an English name is available, otherwise a
transliteration/short ascii slug; if unclear, STOP and ask the user for the slug). The
slug must be stable across re-promotions so updates land in the same folder and produce
a clean `git diff`.

---

## What is promoted (copy manifest)

From `tests/generated/<ts>/` → `tests/e2e/<slug>/` (overwrite on update):

| Copy                          | Commit? | Notes                                              |
| ----------------------------- | ------- | -------------------------------------------------- |
| `cases.md`                    | yes     | the human-readable behavior contract / baseline    |
| `flow.spec.ts` / `flow.{role}.spec.ts` | yes | the executable tests                       |
| `mock-user.setup.ts`          | yes     | role setup (same dir, factory `testMatch` finds it) |
| `mock-users.json`             | yes     | role list the factory reads                        |
| `playwright.config.ts`        | yes     | written fresh as the factory call (see below)      |
| `.auth/state*.json`           | **NO**  | runtime-generated secrets — never committed        |

`tsso.setup.ts` is shared and already lives in `playwright/setup/` — never copied.

---

## Committed config template

`tests/e2e/<slug>/playwright.config.ts` is identical in shape to a session config —
the factory's `repoRoot = resolve(dir, '..','..','..')` resolves correctly for
`tests/e2e/<slug>/` too, so the `tsso-setup → mock-user-setup → chrome[-role]` chain and
the `playwright/.auth/tsso-base.json` path all work unchanged.

CommonJS:
```ts
import { createSessionConfig } from '../../../playwright.config.base';

export default createSessionConfig(__dirname, {
  locale: 'zh-TW',                       // same value the session used
  baseURL: 'http://localhost:3000',      // same target the session used
});
```

ESM (`package.json` has `"type": "module"`):
```ts
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createSessionConfig } from '../../../playwright.config.base';

export default createSessionConfig(path.dirname(fileURLToPath(import.meta.url)), {
  locale: 'zh-TW',
  baseURL: 'http://localhost:3000',
});
```

---

## Provenance

Record where the committed flow came from, so a future regression can be attributed:
prepend to `cases.md` (under the frontmatter) or write `tests/e2e/<slug>/PROVENANCE`:

```
promoted-from: tests/generated/20260520-135959
promoted-at: 2026-05-31 (Asia/Taipei)
target-version: <git SHA / build of the app under test, if recorded in session metadata>
```

---

## Oracle / baseline approval

A promoted flow becomes the permanent correctness baseline, so promotion is the moment a
human declares its captured behavior *correct*. The oracle tags (`@.claude/rules/cases-template.md`)
make explicit which assertions actually have a spec behind them and which are pure
characterization.

- **The promote report must list every `[baseline]` assertion** in the flow (TC id +
  assertion), and list every **conflict** (`[baseline ⚠ PRD 不符：…]`) in a separate,
  prominent section. Compute these by scanning the session's `cases.md` — there is no
  TC-level oracle field to read.
- Print the line: **「按下 promote = 你宣告以下 baseline 現狀為正確基準」**, then the list.
  The human must pass over it. `[prd]` assertions need no sign-off (the spec already backs
  them); `[baseline]` ones are being blessed *now*.
- **Never auto-promote**, and never silently promote a flow that is all-`[baseline]` or has
  unresolved conflicts — surface them and let the human decide. Conflicts are **surfaced,
  not blocking**: a `⚠` does not abort promotion (the flake gate is the only hard gate),
  but it must be shown so the human knows the spec and the app disagree on that assertion.

## Heal-touched locators (sign-off)

A session may have reached green only because Phase C's heal tail re-resolved a drifted
locator (or adjusted a wait). The committed spec then carries those healed selectors as the
new baseline, so promotion is also the moment a human blesses them — same spirit as the
`[baseline]` sign-off above.

- **The promote report must list every locator/wait the heal tail changed in this session**
  (TC id + `old → new`), in its own prominent section alongside the `[baseline]` list.
  Source: the session's `heal-<HHMMSS>.patch` file(s) (the unified diff Phase C's heal tail
  writes). If no `heal-*.patch` exists, the session reached green natively — print
  `（本 session 未經 heal）` and skip the section.
- These are **surfaced, not blocking** (the flake gate is the only hard gate): a healed
  locator that passed the final 3/3 gate is promotable, but the human must see *which*
  selectors were auto-rewritten before declaring this the baseline.

## Re-promotion (update) semantics

If `tests/e2e/<slug>/` already exists, promotion is an **update**, not a new flow:
- Overwrite the files wholesale. Do not merge.
- The value lives in the `git diff`: a changed `cases.md` line is a precise, reviewable
  record of how the validated behavior changed. Surface a 1-line summary in the report.
- This is the regression-guard audit trail — reviewers approve behavior changes via the
  PR diff, exactly like reviewing source code.
- A changed **`[prd]`** assertion means the app diverged from the spec — call it out.
  A changed **`[baseline]`** assertion has no spec to arbitrate, so the reviewer alone
  judges intended-change vs regression from the diff; flag baseline-line diffs explicitly
  in the 1-line summary so they are not rubber-stamped.

---

## Hard rules

- **Flake gate first, always.** Only a 3/3-green session may be promoted — run the gate
  via the session config with `--repeat-each=3 --retries=0` per `@.claude/rules/flake-gate.md`
  (retries MUST be off, or a flaky test recovers and hides). A test that flakes in the
  gate, or any non-empty `quarantine.md`, blocks promotion — quarantine or fix it in the
  session first.
- Never commit `.auth/` state. Ensure `.gitignore` has `tests/e2e/*/.auth/`.
- Promotion is read-only on the source session.
- The committed suite is what CI runs — never have CI regenerate tests on the fly.