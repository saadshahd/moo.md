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
  "notes": "one line per non-obvious label decision"
}
```

- `tags`: subset of `react | db | distributed` (`always` is implicit, never listed).
- `globs`: the TUNED value for each of the corpus's three glob classes, post path-tuning:
  - `default` — rules shipping `**/*.{ts,tsx}` (widen extensions if repo writes .js/.jsx/.mts)
  - `test` — rules shipping `**/*.{test,spec}.{ts,tsx}` (match the repo's real test convention)
  - `react` — rules shipping `**/*.{tsx,jsx}` (monorepo: scope to evidence-bearing package, e.g. `apps/web/**/*.{tsx,jsx}`)
  - Kind-tagged rules in monorepos may additionally scope `default`-class globs per tag; if so add a key per tag (e.g. `"db": "services/api/**/*.ts"`).
- The expected installed rule SET is NOT listed — the scorer derives it from corpus frontmatter + `tags` (when-tag filter), plus the constant pathless pair (`red-green-refactor-is-a-commit-shape`, `tidy-or-behavior-never-both`).

## Tag definitions (label against THESE, not intuition)

- `react`: repo actually writes React/JSX UI (usage evidence: .tsx/.jsx files, JSX in .js). Dep-without-usage does NOT fire.
- `db`: repo owns database access (client/ORM usage in source, schema/migration files). A hosted-API-only consumer does not fire.
- `distributed`: any SIDE-EFFECTFUL remote boundary — the repo makes a remote party durably change state (payments, email/SMS, queue publish, webhook-confirmed flows, bot messaging) or spans reconciling processes. READ-ONLY consumption of remote APIs does NOT fire.

## Provenance rules

- ORIGIN.md must name the exact source (URL + commit SHA, or local path + date) and list every file included.
- Public repos: prefer permissively-licensed, well-known repos. Record the license.
- NEVER invent file contents. If a needed file is too big, trim and mark; if it doesn't exist, the fixture doesn't claim it.
