# Flake Gate (shared by Phase C and Phase D)

A test that passes once is not proven stable — it may be flaky and pass by luck. The
flake gate runs the **passing** tests repeatedly with retries disabled; only a test that
passes every repetition counts as truly green. Flaky tests are quarantined, never silently
counted green, and never promoted.

---

## The gate command

```
npx playwright test --config <session-or-suite>/playwright.config.ts \
  --repeat-each=3 --retries=0 --grep "<TC-id1>|<TC-id2>|..."
```

- `--repeat-each=3` — run each selected test 3 times.
- `--retries=0` — **mandatory.** Retries would let a flaky test recover and hide. The gate
  must require a clean first-try pass on every repetition.
- `--grep` — restrict to the TC ids being gated (see "what gets gated" below).

A TC is **stable** iff it passes 3/3. Anything less (e.g. 2/3) is **flaky**.

---

## Phase C — stages

Phase C adds cost only where it buys information. The first two stages always run; the
heal tail and its final gate run only when `heal:` is enabled (see `@.claude/rules/phase-c-heal.md`):

**Stage 1 — functional run** (normal, with the config's retries):
```
npx playwright test --config tests/generated/<ts>/playwright.config.ts
```
Parse the JUnit result into PASSED and FAILED sets.

**Stage 2 — flake gate** (default on; skip only when `gate: false`):
Run the gate command above, grepping for the **PASSED** TC ids only. Do **not** re-run
FAILED tests here — a consistently failing test is already not green, and a flaky-failing
one is the heal tail's job (it re-runs with its own repeat). Any PASSED TC that does not go
3/3 is reclassified PASSED → **FLAKY (quarantined)**.

**Stage 3 — heal tail + final gate** (`heal:` enabled only): the heal tail classifies the
FAILED set, applies the allowed selector/wait edits, and heal-verifies each patched TC 3×.
Then a **final flake gate** runs over **all now-passing TCs** (natively-passed + healed) —
a healed TC must clear 3/3 here, not just at the moment it was edited. A TC that fails the
final gate is quarantined or reclassified per `@.claude/rules/phase-c-heal.md`.

**Final classification:** `STABLE` (3/3) · `FAILED` · `FLAKY`.

---

## Quarantine manifest

When any TC is flaky, write `tests/generated/<ts>/quarantine.md`:

```
# Quarantine — tests/generated/<ts>

| TC      | Stage-1 | Flake gate | Status |
| ------- | ------- | ---------- | ------ |
| TC-002  | passed  | 2/3        | FLAKY  |
```

The manifest is non-destructive: it does **not** add `skip`/`fixme` to the spec (that
would mask the problem). It records instability for the user to fix.

---

## What "green" means (enforced)

- A run is **fully green** only if `FAILED = 0` **and** `FLAKY = 0`.
- Phase C never reports a run with flaky TCs as green — it lists each quarantined TC.
- **Phase D (`/promote`) requires fully green.** If `quarantine.md` is non-empty (or any
  TC is FAILED), promotion is aborted — a flaky test must never enter the committed
  `tests/e2e/` suite. Fix or stabilize the TC in the session first, then re-gate.

---

## Cost control

- Stage 2 gates only the PASSED set, never the FAILED set.
- `gate: false` (input param) skips Stage 2 for fast local iteration — but Phase D always
  runs the gate regardless, so an ungated session can still be caught at promote.