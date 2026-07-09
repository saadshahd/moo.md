---
name: setup
description: Use when installing, refreshing, or re-tuning sound taste rules in a project. Triggers on "sound setup", "install taste rules", "scaffold .claude/rules", "set up sound here", starting work in a repo with no .claude/rules/, or a taste-not-defined nudge. Also use to re-run after a stack change (new framework, new package in a monorepo).
---

# sound:setup

Scaffold a project's `.claude/rules/` from the sound corpus: probe the repo's stack, confirm findings with the user, install the matching rule subset with repo-tuned `paths` globs and a provenance stamp. Rule BODIES are copied byte-identical — local taste changes belong in the corpus or in separate local rule files, never in installed copies.

Corpus location: `../../corpus/` relative to this SKILL.md (105 rule files). If the corpus is missing or unreadable, STOP and say so — never install a partial set silently.

## Phase 1 — Probe

Goal: decide which kind-tags apply. `always` rules install everywhere; the decision is over `react`, `db`, `distributed`.

**Usage evidence decides — manifest presence only tells you where to look.** A dep can be dead weight, hoisted, or tooling-only. For every manifest hint, verify in source before proposing the tag.

Method: read every `package.json` (root + workspaces) and workspace markers (`pnpm-workspace.yaml`, `turbo.json`) → hypothesis list. Then verify each hypothesis against source. While there, also record: source extensions actually written (`.ts`/`.tsx`/`.js`/`.jsx`/`.mts`), the real test-file convention — read the test RUNNER'S config (vitest/jest include patterns, ava files) when one exists, since it's authoritative over filename guessing and settles which suffixes belong to unit tests vs e2e — and which workspace package each piece of evidence lives in.

| Tag | Fires on (verified usage) | Does NOT fire on |
|---|---|---|
| `react` | `.tsx`/`.jsx` files, JSX or react imports in real source | react in deps with zero usage; react-shaped tooling (ink absent too) |
| `db` | db client/ORM imported in source (prisma, drizzle, pg, kysely, mongoose, neo4j, clickhouse, redis-as-store…); EMBEDDED dbs with owned DDL/schema (sqlite, node:sqlite, level); owned schema/migration files | consuming someone else's hosted API without owning storage |
| `distributed` | any SIDE-EFFECTFUL remote boundary: payments (stripe), email/SMS (nodemailer, twilio), queue/broker publish (kafkajs, bullmq, amqplib, redis `.publish()` feeding another process), webhook handlers, bot messaging SDKs, multiple owned services reconciling state | READ-ONLY consumption of remote APIs (fetch-and-render); analytics beacons; redis as a plain same-process cache (get/set/del only) |

A rule tagged with multiple kinds (`when: db, distributed`) installs when ANY of its tags is confirmed.

## Phase 2 — Confirm (never skip, never auto-install)

Present to the user, compactly: the extracted facts (each with its file evidence), the proposed tag set, and the proposed glob tunings from Phase 4. Ask for confirmation or correction. The user's answer is the verdict — a corrected tag set replaces yours without argument. Only proceed to install after explicit confirmation.

**Propose-only mode:** when the invocation asks for a proposal only (evals, dry runs), emit exactly this JSON and stop — no confirmation, no writes:

```json
{"facts": ["<evidence with file paths>"], "tags": ["react"], "globs": {"default": "**/*.{ts,tsx}", "test": "**/*.{test,spec}.{ts,tsx}", "react": "**/*.{tsx,jsx}"}}
```

`tags` contains ONLY confirmed kind-tags from {react, db, distributed} — `always` is not a tag, it's the unconditional baseline; listing it is an error. The pathless pair (Phase 4 rule 5) is NOT part of the proposal — it's a mechanical constant, not a judgment.

`globs` keys: `default` and `test` always (they cover the `always` rules); `react` REQUIRED whenever the react tag fires (its rules ship a distinct glob class — omitting the key breaks them) and absent otherwise; plus one key per kind-tag ONLY when monorepo scoping makes its glob differ from `default` (e.g. `"db": "services/api/**/*.ts"`) — a per-tag key repeating the default glob is noise. Every value is the TUNED glob.

## Phase 3 — Cherry-pick

Selected set = every corpus rule whose `when:` is `always` or intersects the confirmed tags. Nothing else. Do not curate by opinion — the when-tag filter IS the selection.

## Phase 4 — Tune paths

Principle: **a rule's glob must be able to fire before its Detect moment.** `.claude/rules/` has two loading modes — `paths:` files inject on Read/Edit of a matching file; pathless files load at session launch. A glob that can never match this repo's files is a silently-dead rule; a glob that only matches files edited AFTER the violation moment is worse.

1. **Extensions** — repo writes SUBSTANTIVE source in `.js`/`.jsx`/`.mts` too? Widen `{ts,tsx}` to match. Tooling config files alone (`tailwind.config.js`, `eslint.config.js`…) do NOT widen — the rules target code the team writes, not scaffolding. Pure-TS repos keep corpus defaults. The react-class glob widens only to JSX-BEARING extensions: `{tsx,jsx}`, or `.js` where the repo writes JSX inside `.js`.
2. **Test convention** — replace the `**/*.{test,spec}.{ts,tsx}` class with the repo's real convention, expressed as the SUFFIX pattern alone, repo-wide (`**/*.test.ts`) — do NOT directory-scope it just because tests happen to sit in one dir (rule 4 applies here too). Directory-scope only when the convention has no suffix at all (ava-style bare `test/**/*.js`) or the suffix would match real non-test files. Include only the suffix arms the repo's unit tests actually use: if `.spec.ts` files exist but belong to a different runner (Playwright e2e), they stay OUT of the test class.
3. **Monorepo scoping (kind-tagged rules only)** — if a tag's evidence lives entirely in specific packages, scope that tag's rules to them (`apps/web/**/*.{tsx,jsx}`). `always` rules stay repo-wide.
4. **No other narrowing** — never tighten to `src/**` in single-package repos. Unmatched `paths` files cost nothing; narrowing only buys miss-risk.
5. **Pathless pair** — `red-green-refactor-is-a-commit-shape` and `tidy-or-behavior-never-both` Detect on COMMIT shape, which no edit-glob reaches: strip their `paths` key entirely so they load at launch.

## Phase 5 — Stamp and write

For each selected rule, write `.claude/rules/<rule-name>.md`: body byte-identical to corpus; frontmatter = tuned `paths` (or none for the pathless pair), original `when:` and `source:`, plus one stamp line:

```yaml
sound: <rule-name>@<plugin-version> body:<sha8>
```

`<sha8>` = first 8 hex chars of sha256 over the body (every byte AFTER the frontmatter's closing `---` line and its newline). Compute, don't estimate:

```bash
awk 'f>1{print} /^---$/{f++}' rule.md | shasum -a 256 | cut -c1-8
```

`<plugin-version>` comes from the sound plugin's `plugin.json`. After writing, verify one file round-trips: recompute its body hash and compare to its stamp. Mismatch = your write mangled the body — fail loud, fix, re-verify.

## Re-runs (idempotent, drift-loud)

- **Unstamped file in `.claude/rules/`** → local taste. Invisible to setup: never update, never delete, never mention except to note it was preserved.
- **Stamped + body hash matches stamp** → managed. Free to update body (new corpus version) and re-tune paths.
- **Stamped + body hash differs** → the user edited an installed copy, violating the contract. STOP for that file: list it, show the divergence, ask whether to keep the local edit (convert to unstamped local rule) or restore from corpus. Never silently overwrite.
- Tags are re-derived every run (fresh probe + confirm) — no memory of previous runs beyond the stamps themselves.

## Failure modes to keep loud

- Corpus unreachable / rule file unparseable → stop before writing anything.
- User declines all tags → install `always` rules only; say that's what happened.
- Repo has no JS/TS at all → the corpus doesn't apply; say so and install nothing.
