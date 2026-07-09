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
  "globs": {
    "default": "**/*.{ts,tsx}",
    "test": "**/*.{test,spec}.{ts,tsx}",
    "react": "**/*.{tsx,jsx}"
  },
  "rules": {
    "must_install": ["command-vs-fact-when-reconciled-elsewhere"],
    "must_not_install": ["mood-names-commands-facts"]
  },
  "notes": "one line per non-obvious label decision, including WHY each rules label"
}
```

- `tags`: subset of `react | db | distributed` (`always` is implicit, never listed).
- `globs`: the TUNED value for each of the corpus's three glob classes, post path-tuning:
  - `default` — rules shipping `**/*.{ts,tsx}` (widen extensions if repo writes .js/.jsx/.mts)
  - `test` — rules shipping `**/*.{test,spec}.{ts,tsx}` (match the repo's real test convention)
  - `react` — rules shipping `**/*.{tsx,jsx}` (monorepo: scope to evidence-bearing package, e.g. `apps/web/**/*.{tsx,jsx}`)
  - Kind-tagged rules in monorepos may additionally scope `default`-class globs per tag; if so add a key per tag (e.g. `"db": "services/api/**/*.ts"`).
  - Repo has ZERO test files → `test` keeps the corpus suffix default with extensions matched to the repo's real source extensions (`**/*.{test,spec}.ts` when no .tsx exists, `**/*.{test,spec}.js` for pure-JS). Unverifiable against a real convention by definition; note it. (Labeler-confirmed convention, 2026-07-09.)
  - Extension widening follows the skill's SUBSTANTIVE-source bar: a lone demo/scaffold script does not widen `default` (labeler-confirmed on dead-dep-react's single root demo-ui.js, 2026-07-09).
- `rules`: THREE-CLASS labels — the when-tag filter is only candidacy; selection is per-rule subject-surface judgment, and these labels fence its rate:
  - `must_install` — rules the fixture's code plainly earns (its reason for existing). Each needs a citable surface in the included files; note WHY.
  - `must_not_install` — the grab-bag rules the fixture exists to exclude (subject absent from the repo, or `Not-when:` vetoes). These carry the discriminating power.
  - Everything unlabeled is DON'T-CARE by design — never attempt 104-way exact labels; label only rules where this fixture discriminates (aim 5–15 total).
  - Universal-subject rules (naming, transformation shape, comments) pass trivially everywhere — labeling them `must_not_install` is almost always a label bug.
  - Test-scoped rules key off the CODE UNDER TEST, not test-file presence (labeler-confirmed 2026-07-09): zero test files does NOT justify `must_not_install` for general testing rules when testable logic exists; shape-specific test rules (roundtrip, generators) still need their shape.
  - The scorer additionally checks (no labels needed): every proposed rule name exists in the corpus; every citation path exists in `tree.txt`.

## Tag definitions (label against THESE, not intuition)

- `react`: repo actually writes React/JSX UI (usage evidence: .tsx/.jsx files, JSX in .js). Dep-without-usage does NOT fire.
- `db`: repo owns database access (client/ORM usage in source, schema/migration files). A hosted-API-only consumer does not fire.
- `distributed`: any SIDE-EFFECTFUL remote boundary — the repo makes a remote party durably change state (payments, email/SMS, queue publish, webhook-confirmed flows, bot messaging) or spans reconciling processes. READ-ONLY consumption of remote APIs does NOT fire. Publisher-side evidence alone SUFFICES (labeler-confirmed 2026-07-09): a real `.publish()` fires the tag even when no in-repo consumer exists — consumers usually live outside the repo, and the corpus's distributed rules govern the publisher's shape.

## Provenance rules

- ORIGIN.md must name the exact source (URL + commit SHA, or local path + date) and list every file included.
- Public repos: prefer permissively-licensed, well-known repos. Record the license.
- NEVER invent file contents. If a needed file is too big, trim and mark; if it doesn't exist, the fixture doesn't claim it.
