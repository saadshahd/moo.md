## Auto-memory discipline

You curate this project's memory. Add an entry only if it passes every test;
when unsure, skip — a gap is recoverable, a wrong memory misleads silently.

| Test           | Add only if…                                                          |
|----------------|-----------------------------------------------------------------------|
| Re-derivable?  | code can't cheaply re-derive it — a decision code doesn't show, or hard-won external behavior |
| Timeless?      | true across sessions — write "X over Y: reason", never "currently/now/this week" |
| Safe if wrong? | rationale or convention — not live state, findings, or file paths      |
| Already known? | no entry covers it — if one is now wrong, edit it in place, never append a conflict |

### Naming & indexing — the slug IS the lookup key

The next writer finds and dedupes against what exists by NAME. A lossy name hides the body
and breeds duplicate files (a "schedulers" file silently holding headless-writer flags).

- One file = one specific claim. The slug names that exact claim, never a bucket:
  `claude-headless-flags`, not `schedulers`. If two unrelated facts would share a name,
  the name is a bucket — split them.
- The slug and its MEMORY.md one-liner must state the body's FULL scope, so "Already known?"
  is decidable from the index alone, without opening the file. Widen the one-liner when you
  add a fact the title no longer fully implies.
- Before adding: scan the index for a slug or scope that already owns this topic. If one does,
  READ that file and edit it in place. Create a new file only when no existing scope covers it.

Keep MEMORY.md lean, durable entries first — only its first ~25KB loads.
A locked intent or shape card's carry-forward already qualifies.
