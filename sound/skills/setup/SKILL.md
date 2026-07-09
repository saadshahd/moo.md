---
name: setup
description: Use when installing, refreshing, or re-tuning sound taste rules in a project. Triggers on "sound setup", "install taste rules", "scaffold .claude/rules", "set up sound here", starting work in a repo with no .claude/rules/, or a taste-not-defined nudge. Also use to re-run after a stack change (new framework, new package in a monorepo).
---

# sound:setup

Scaffold a project's `.claude/rules/` from the sound corpus: probe the repo's stack, confirm findings with the user, install the matching rule subset with repo-tuned `paths` globs. Once written, the files belong to the user; re-runs reconcile against what exists (see Re-runs).

Corpus location: `../../corpus/` relative to this SKILL.md. If it is missing or unreadable, STOP and say so — never install a partial set silently.

## Phase 1 — Probe

Goal: decide which kind-tags apply. `always` rules install everywhere; the decision is over `react`, `db`, `distributed`.

**Usage evidence decides — manifest presence only tells you where to look.** A dep can be dead weight, hoisted, or tooling-only. For every manifest hint, verify in source before proposing the tag.

Method: read every `package.json` (root + workspaces) and workspace markers (`pnpm-workspace.yaml`, `turbo.json`) → hypothesis list. Then verify each hypothesis against source. While there, also record: source extensions actually written (`.ts`/`.tsx`/`.js`/`.jsx`/`.mts`), the real test-file convention — read the test RUNNER'S config (vitest/jest include patterns, ava files) when one exists, since it's authoritative over filename guessing and settles which suffixes belong to unit tests vs e2e — and which workspace package each piece of evidence lives in.

| Tag | Fires on (verified usage) | Does NOT fire on |
|---|---|---|
| `react` | `.tsx`/`.jsx` files, JSX or react imports in real source | react in deps with zero usage; react-shaped tooling (ink absent too) |
| `db` | db client/ORM imported in source (prisma, drizzle, pg, kysely, mongoose, neo4j, clickhouse, redis-as-store…); EMBEDDED dbs with owned DDL/schema (sqlite, node:sqlite, level); owned schema/migration files | consuming someone else's hosted API without owning storage |
| `distributed` | any SIDE-EFFECTFUL remote boundary: payments (stripe), email/SMS (nodemailer, twilio), queue/broker publish (kafkajs, bullmq, amqplib, redis `.publish()` feeding another process), webhook handlers, bot messaging SDKs, multiple owned services reconciling state | READ-ONLY consumption of remote APIs (fetch-and-render); analytics beacons; redis as a plain same-process cache (get/set/del only) |

## Phase 2 — Cherry-pick

Selected set = every corpus rule whose `when:` is `always` or shares ANY tag with the Phase 1 tag set — nothing added or removed by opinion; the when-tag filter IS the selection.

## Phase 3 — Tune paths

Principle: **a rule's glob must be able to fire before its Detect moment.** `.claude/rules/` has two loading modes — `paths:` files inject on Read/Edit of a matching file; pathless files load at session launch. A glob that can never match this repo's files is a silently-dead rule; a glob that only matches files edited AFTER the violation moment is worse.

1. **Extensions** — repo writes SUBSTANTIVE source in `.js`/`.jsx`/`.mts` too? Widen `{ts,tsx}` to match. Tooling config files alone (`tailwind.config.js`, `eslint.config.js`…) do NOT widen — the rules target code the team writes, not scaffolding. Pure-TS repos keep corpus defaults. The react-class glob covers JSX-BEARING extensions ONLY: `{tsx,jsx}` (or `.js` where the repo writes JSX inside `.js`) — never `.ts`. WRONG: `frontend/**/*.{ts,tsx}`. RIGHT: `frontend/**/*.{tsx,jsx}`.
2. **Test convention** — replace the `**/*.{test,spec}.{ts,tsx}` class with the repo's real convention, expressed as the SUFFIX pattern alone, repo-wide (`**/*.test.ts`) — do NOT directory-scope it just because tests happen to sit in one dir (rule 4 applies here too). Directory-scope only when the convention has no suffix at all (ava-style bare `test/**/*.js`) or the suffix would match real non-test files. Include only the suffix arms the repo's unit tests actually use: if `.spec.ts` files exist but belong to a different runner (Playwright e2e), they stay OUT of the test class.
3. **Monorepo scoping (kind-tagged rules only)** — if a tag's evidence lives entirely in specific packages, scope that tag's rules to them (`apps/web/**/*.{tsx,jsx}`). `always` rules stay repo-wide.
4. **No other narrowing** — never tighten to `src/**` in single-package repos. Unmatched `paths` files cost nothing; narrowing only buys miss-risk.
5. **Pathless pair** — `red-green-refactor-is-a-commit-shape` and `tidy-or-behavior-never-both` Detect on COMMIT shape, which no edit-glob reaches: strip their `paths` key entirely so they load at launch.

## Phase 4 — Confirm (never skip, never auto-install)

Present to the user, compactly: the extracted facts (each with its file evidence), the proposed tag set, and the proposed glob tunings from Phase 3. Ask for confirmation or correction. The user's answer is the verdict — a corrected tag set replaces yours without argument; redo Phases 2–3 with it. Only write after explicit confirmation.

**Propose-only mode:** when the invocation asks for a proposal only (evals, dry runs), emit exactly this JSON and stop — no confirmation, no writes:

```json
{"facts": ["<evidence with file paths>"], "tags": ["react"], "globs": {"default": "**/*.{ts,tsx}", "test": "**/*.{test,spec}.{ts,tsx}", "react": "**/*.{tsx,jsx}"}}
```

`tags` contains ONLY kind-tags from {react, db, distributed} — `always` is not a tag, it's the unconditional baseline; listing it is an error. The pathless pair (Phase 3 rule 5) is NOT part of the proposal — it's a mechanical constant, not a judgment.

`globs` keys: `default` and `test` always (they cover the `always` rules); `react` REQUIRED whenever the react tag fires (its rules ship a distinct glob class — omitting the key breaks them) and absent otherwise; plus one key per kind-tag ONLY when monorepo scoping makes its glob differ from `default` (e.g. `"db": "services/api/**/*.ts"`) — a per-tag key repeating the default glob is noise. Every value is the TUNED glob.

## Phase 5 — Write

For each selected rule, write `.claude/rules/<rule-name>.md`: body from the corpus; frontmatter = the tuned `paths` line ONLY — no `when:`, no `source:`. The pathless pair gets no frontmatter at all. No marker, manifest, or hash.

## Re-runs (reconcile, never overwrite)

`.claude/rules/` may already hold files — from a previous setup, hand-written, or evolved past what setup wrote. Every existing file is user-owned; reconcile by reading, not bookkeeping:

- **Existing file, no same-named corpus rule** → local taste. Leave untouched; mention only that it was preserved.
- **Selected corpus rule, no existing file** → propose as an addition.
- **Both exist** → compare bodies. Identical → at most re-tune `paths` if the repo changed. Different → the user may have evolved it or the corpus moved since install — you cannot tell which, so show the diff and ask: keep theirs, take the corpus version, or keep both (theirs renamed as a local rule). Never silently overwrite.

Present the whole reconciliation as ONE compact proposal (additions / updates / preserved) and write only what the user confirms. Tags are re-derived every run — fresh probe + confirm, no memory of previous runs.

## Failure modes to keep loud

- Corpus unreachable / rule file unparseable → stop before writing anything.
- User declines all tags → install `always` rules only; say that's what happened.
- Repo has no JS/TS at all → the corpus doesn't apply; say so and install nothing.
