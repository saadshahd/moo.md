# Fixture spec — sound:setup evals

Each fixture is a TRIMMED SKELETON of a REAL repo (never fabricated). Layout:

```
sound/evals/fixtures/<fixture-name>/
  repo/            # the skeleton the probe runs against
  expected.json    # human-verifiable labels (scoring ground truth)
  ORIGIN.md        # provenance: source repo (URL or local path), commit/date, what was trimmed and why
```

## repo/ contents (evidence-bearing files ONLY, target < 30 files, < 100KB total)

- Every `package.json` (root + workspace packages), verbatim.
- Workspace markers: `pnpm-workspace.yaml`, `turbo.json` if present.
- `tree.txt` at repo/ root: output of `find . -type f -not -path '*/node_modules/*' | head -400` from the REAL repo — the full file listing IS evidence (extensions, test conventions, dir shapes). Generate from the real repo, never hand-write.
- 3–8 representative REAL source files, chosen to carry the discriminating evidence: e.g. a file importing the db client, a webhook route handler, a file calling a side-effectful SDK, one test file showing the naming convention. Copy verbatim; truncate bodies > 150 lines with a `// [trimmed]` tail marker.
- Config that carries evidence: `tsconfig.json`, `prisma/schema.prisma`, migration dir listing, vitest/jest config.

## expected.json shape

```json
{
  "tags": ["react", "db"],
  "rules": {
    "must_install": ["command-vs-fact-when-reconciled-elsewhere"],
    "must_not_install": ["mood-names-commands-facts"]
  },
  "notes": "one line per non-obvious tag decision",
  "rules_notes": {
    "command-vs-fact-when-reconciled-elsewhere": "+ path/file.ts — one-line WHY citing the surface",
    "mood-names-commands-facts": "- WHY the repo shows no surface / Not-when veto"
  }
}
```

- `tags`: subset of `react | db | distributed` — the Phase 1 stack facts, nothing else.
- `rules`: THREE-CLASS labels — tags classify the stack; selection is per-rule subject-surface judgment, and these labels fence its rate:
  - `must_install` — rules the fixture's code plainly earns (its reason for existing). Each needs a citable surface in the included files; note WHY in `rules_notes`.
  - `must_not_install` — the grab-bag rules the fixture exists to exclude (subject absent from the repo, or `Not-when:` vetoes). These carry the discriminating power.
  - Everything unlabeled is DON'T-CARE by design — never attempt full-corpus exact labels; label only rules where this fixture discriminates (aim 5–15 total).
  - Universal-subject rules (naming, transformation shape, comments) pass trivially everywhere — labeling them `must_not_install` is almost always a label bug.
  - Test-scoped rules key off the CODE UNDER TEST, not test-file presence (labeler-confirmed 2026-07-09): zero test files does NOT justify `must_not_install` for general testing rules when testable logic exists; shape-specific test rules (roundtrip, generators) still need their shape.
  - TS-prescription rules (casts, branded types, `satisfies`, compile-time exhaustiveness) are `must_not_install` in pure-JS repos — a prescription the repo cannot follow (labeler-confirmed 2026-07-10).
  - Out-of-order-capable event delivery (Stripe webhooks) IS an ordering-hazard surface for stale-message rules, distinct from idempotency (labeler-confirmed 2026-07-10).
  - The scorer additionally checks (no labels needed): every proposed rule name exists in `corpus/ ∪ corpus-optin/` (the two-universe name check, #153); no proposed rule lives in `corpus-optin/` unless this fixture declares it in `optin` (the fail-loud opt-in gate); every citation path exists in `tree.txt` ∪ the fixture's included `repo/` files (tree.txt is head-400-truncated, so an included excerpt file may be absent from it).
- `optin` (optional, #153): rule names this fixture explicitly opts into from `corpus-optin/`. A fixture omitting it — the default — must NOT propose any opt-in rule; the scorer fails loud (`rule:optin`) if it does. Present only for fixtures that deliberately exercise an opt-in rule (none today).

## Tag definitions (label against THESE, not intuition)

The single source is the Phase 1 tag table in `../skills/setup/SKILL.md` — label against it verbatim (it carries the fire/does-NOT-fire columns, the publisher-side-suffices clause, and the framework-wrapped-senders carve). Never restate it here; when it moves, labels re-audit against the new table.

## Provenance rules

- ORIGIN.md must name the exact source (URL + commit SHA, or local path + date) and list every file included.
- Public repos: prefer permissively-licensed, well-known repos. Record the license.
- NEVER invent file contents. If a needed file is too big, trim and mark; if it doesn't exist, the fixture doesn't claim it.
