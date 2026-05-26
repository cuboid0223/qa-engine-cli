# Pattern Annotation

Some flows use UI patterns that require specialized Playwright guidance. Phase A detects these patterns during exploration and annotates `cases.md` so Phase B knows which extra guides to load.

**Phase A — annotation rule:**
At the top of `cases.md`, add a `patterns:` field listing all patterns present in this flow. Use only values from the enum below — no freeform values.

```yaml
patterns:
  - crud
  - search-filter
```

Valid values: `crud`, `search-filter`, `file-upload`, `multi-tab`, `multi-user`, `drag-drop`, `websocket`, `iframe`, `network-mock`, `browser-api`, `clock-mock`

If none apply, omit the field entirely — do not write `patterns: []`.

**Phase B — consumption rule:**
Covered in `.claude/rules/phase-b-generate.md` (pattern-based guide loading section).
