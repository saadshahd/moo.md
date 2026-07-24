# Re-runs (reconcile, never overwrite)

Existing `.claude/sound/` files — prior setup, hand-written, or evolved — are user-owned; reconcile by reading, not bookkeeping. Older installs may carry project-tuned code examples and users may add their own snippets, so never compare whole bodies — compare PROSE ONLY: content minus any frontmatter and fenced code blocks, whitespace-normalized.

- **Existing file, no same-named corpus rule** → local taste. Leave untouched; mention it was preserved.
- **Selected corpus rule, no existing file** → propose as an addition. Every re-run re-derives tags and re-runs selection fresh — a newly-appeared surface makes its rules newly proposable. No memory of prior runs.
- **Both exist, prose identical** → in-sync. Leave untouched — any local code snippets it carries are user-owned.
- **Both exist, prose differs** → you cannot tell whether the user evolved it or the corpus moved; show the prose diff and ask: keep theirs, take the corpus version, or keep both (theirs renamed as a local rule). Never silently overwrite.

Present the whole reconciliation as ONE compact proposal (additions / updates / preserved); write only what the user confirms.
