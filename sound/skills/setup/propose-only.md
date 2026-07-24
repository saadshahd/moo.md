# Propose-only mode

When the invocation asks for a proposal only (evals, dry runs), emit exactly this JSON and stop — no confirmation, no writes:

```json
{"facts": ["<evidence with file paths>"], "tags": ["react"], "rules": [{"name": "<corpus-rule-name>", "cite": "<repo file path>"}]}
```

`tags` contains ONLY kind-tags from {react, db, distributed} — the Phase 1 stack facts, nothing else; listing anything else is an error. `rules` lists ONLY the install set: every selected rule's corpus FILENAME (no `.md`) COPIED VERBATIM from the corpus listing — never reconstructed from memory; before emitting, verify every name matches an existing `corpus/` file (or a `corpus-optin/` file the user named). `cite` is one FILE path that exists in the repo (no directories). Skips are not emitted.
