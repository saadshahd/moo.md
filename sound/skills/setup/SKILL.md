---
name: setup
description: Use when installing, refreshing, or re-tuning sound taste rules in a project. Triggers on "sound setup", "install taste rules", "scaffold .claude/sound", "set up sound here", starting work in a repo with no .claude/sound/, or a taste-not-defined nudge. Also use to re-run after a stack change (new framework, new package in a monorepo).
---

# sound:setup

Scaffold a project's taste rules from the sound corpus: probe the stack, select ONLY the rules whose subject the repo's code actually shows — evidence-cited per rule, never a tag-wide dump — confirm with the user, then install with examples rewritten in the project's own domain. Each selected rule lands as a plain reference file in a browsable `.claude/sound/<topic>/` map — the tree the `sound:prime` skill points at. Written files belong to the user; re-runs reconcile (see Re-runs).

Corpus: `../../corpus/` relative to this SKILL.md — the default candidate universe. A sibling `../../corpus-optin/` holds opt-in rules, excluded from candidacy unless the user names one at invocation (Phase 2). If `corpus/` is missing or unreadable, STOP and say so — never install a partial set silently.

## Phase 1 — Probe

Decide which kind-tags apply — a PRE-FILTER for Phase 2 candidacy, not the selection.

**Usage decides; manifest presence only says where to look.** A dep can be dead weight, hoisted, or tooling-only — verify every hint at its USE sites in source before proposing a tag. Negatives need the same rigor: a client's config/wrapper file never clears a dep on its own; search its use sites (`.publish(`, `.send(`, `.create(`…) before ruling a tag out. Read every `package.json` (root + workspaces) and workspace markers (`pnpm-workspace.yaml`, `turbo.json`) → hypotheses → verify each in source. Note TS / pure-JS / neither: it sets the TS-only veto (Phase 2) and the no-JS/TS abort (Failure modes).

| Tag | Fires on (verified usage) | Does NOT fire on |
|---|---|---|
| `react` | `.tsx`/`.jsx` files, JSX or react imports in real source | react in deps with zero usage; react-shaped tooling (ink absent too) |
| `db` | db client/ORM imported in source (prisma, drizzle, pg, kysely, mongoose, neo4j, clickhouse, redis-as-store…); EMBEDDED dbs with owned DDL/schema (sqlite, node:sqlite, level); owned schema/migration files | consuming someone else's hosted API without owning storage |
| `distributed` | any SIDE-EFFECTFUL remote boundary: payments (stripe), email/SMS (nodemailer, twilio — FRAMEWORK-WRAPPED senders count: an auth provider configured with an SMTP transport, e.g. next-auth EmailProvider, IS email-sending usage even with no direct nodemailer import), queue/broker publish (kafkajs, bullmq, amqplib, redis `.publish()`), webhook handlers, bot messaging SDKs, multiple owned services reconciling state. Publisher-side evidence alone is SUFFICIENT — the consumer usually lives outside the repo; requiring an in-repo consumer would blind the tag on exactly the topology it exists for | READ-ONLY consumption of remote APIs (fetch-and-render); analytics beacons; redis as a plain same-process cache (get/set/del only) |

## Phase 2 — Select (per rule, evidence-cited)

Candidates = every `corpus/` rule whose `when:` is `always` or shares ANY tag with the Phase 1 set. Candidacy is where the tag filter's job ENDS.

**Opt-in gate (deterministic).** The candidate universe is `corpus/` ONLY. A `corpus-optin/` rule enters candidacy solely when the user names it at invocation — then read it from `corpus-optin/`. Directory membership is the gate (zero-LLM); a default run never proposes an opt-in rule.

A candidate installs iff the repo contains the SUBJECT-SURFACE the rule governs — code where the rule's `Detect:` question is askable — cited as ONE FILE path (never a directory, never a glob). The rule's `Not-when:` can veto. No citation, no install. An actual violation is NOT required (rules are prevention; they arrive before the first sin) and its absence never vetoes. Existing COMPLIANCE is evidence FOR install: a repo already doing the RIGHT shape has the surface, and the rule guards every future edit of it.

A fired tag earns NOTHING by itself — each rule's OWN Detect question must be askable at the cited file. WRONG: repo publishes to Redis → install every distributed rule. RIGHT: it publishes but has no replicas, no supervised queue, no versioned concurrent writes → the fold/restart-policy/write-conflict rules are skipped, each with its reason.

- Subject-bearing rule: `command-vs-fact-when-reconciled-elsewhere` installs iff the repo has async-reconciled state (a server ack, a queue, a webhook-confirmed flow) — cite the file. A repo that names no events does not get the event-naming rules.
- Universal-subject rule (subject is "any code": naming, transformation shape, comments, function design): passes trivially — cite any substantive source file. Never manufacture deeper evidence.
- A rule whose RIGHT shape requires TypeScript (casts, branded types, `satisfies`, compile-time exhaustiveness) never installs in a pure-JS repo — a prescription the repo cannot follow is dead weight.
- `always` does NOT mean universal-subject: command/event-naming, intent-vs-fact splits, and ledger rules are always-CANDIDATES but subject-bearing — they need their surface (a named event vocabulary, state reconciled elsewhere, an append-only store).
- Test-scoped rule: its subject is the CODE UNDER TEST, never test-file presence — a zero-test repo with testable logic still earns the general testing rules (cite the testable code). Test rules with a more specific shape (roundtrip laws need encode/decode pairs; property generators need domain invariants) still need THAT shape cited.
- Every rejected candidate gets a one-line reason (surfaced at Confirm) — rejection reasons are how the user audits the judgment.

Method — DEEP by design; spend the tokens. Partition candidates into batches of rules that look at the same code (seed with when-tags and each rule's subject), dispatch one subagent per batch with its rules' full text and repo access; each returns per-rule `install + citation` or `skip + reason`. Propose-only mode (below) may run inline — the output SET is what's judged, not the mechanism.

## Phase 3 — Confirm (never skip, never auto-install)

Present compactly: the extracted facts (each with file evidence), the proposed tag set, and the proposed rule set — each rule as name + citation + its one-line statement (name-only is uninformed consent; the user must see what each rule requires before approving) — plus the rejected candidates grouped with their reasons. The statement is the rule body's opening mandate: the prose right after the `when: … · tier: … · check: …` metadata line — its first sentence, extended to the next only when the first merely scopes or defines without stating the mandate (e.g. `derive-dont-sync`, `module-is-the-noun-functions-are-bare-verbs`). Never the WRONG/RIGHT code, `_Avoid_`, or `Detect:`. Ask for confirmation or correction; the user's answer is the verdict — a corrected set replaces yours without argument, redo the affected phases. Write only after explicit confirmation. The user confirms the SET here; tuned example bodies are Phase 4–5 output they own afterward.

**Propose-only mode:** when the invocation asks for a proposal only (evals, dry runs), emit exactly this JSON and stop — no confirmation, no tuning, no writes:

```json
{"facts": ["<evidence with file paths>"], "tags": ["react"], "rules": [{"name": "<corpus-rule-name>", "cite": "<repo file path>"}]}
```

`tags` contains ONLY kind-tags from {react, db, distributed} — `always` is not a tag, it's the unconditional candidacy baseline; listing it is an error. `rules` lists ONLY the install set: every selected rule's corpus FILENAME (no `.md`) COPIED VERBATIM from the corpus listing — never reconstructed from memory; before emitting, verify every name matches an existing `corpus/` file (or a `corpus-optin/` file the user named). `cite` is one FILE path that exists in the repo (no directories). Skips are not emitted.

## Phase 4 — Tune examples (confirmed set only)

Rewrite each confirmed rule's fenced WRONG/RIGHT code in the project's own domain — its real nouns, types, and naming style — as PLAUSIBLE project code, never a verbatim quote of an existing violation. ALL prose is byte-preserved: statement, `_Avoid_`, `Detect:`, `Not-when:`, `Cross-ref:` stay corpus-verbatim — the examples localize, the law does not. Batch across subagents as in Phase 2.

Mechanical gates per tuned rule — any gate fails → keep the corpus example for that rule and say so; never install code that flunks a gate:

1. **Syntax-valid TS** — the fenced code parses (`tsc --noEmit`-clean at the syntax level; unresolved project names tolerated, snippets carry no imports).
2. **De-genericized** — no stock corpus nouns (`Order`, `Invoice`, `OrderStatus`, `Payment`, `Cart`…) unless that noun greps in the repo's own source (then it IS the domain).
3. **Grounded** — at least one identifier in the tuned example greps to a real identifier in the repo.

## Phase 5 — Write

Write each confirmed rule's Phase-4 body to `.claude/sound/<topic>/<rule-name>.md` — a plain reference file, NO frontmatter. `<topic>` is the corpus `topic:` value verbatim. These live OUTSIDE `.claude/rules/`, so they never auto-load: the agent pulls one only when it reads it, and the browsable `.claude/sound/` tree IS the map `sound:prime` points at. No marker, manifest, or hash anywhere.

## Re-runs (reconcile, never overwrite)

`.claude/sound/` may already hold rule files — from a previous setup, hand-written, or evolved past what setup wrote. Every existing file is user-owned; reconcile by reading, not bookkeeping. Installed examples are tuned BY DESIGN, so whole-body comparison is meaningless — compare PROSE ONLY: body minus any frontmatter minus fenced code blocks, whitespace-normalized.

- **Existing file, no same-named corpus rule** → local taste. Leave untouched; mention it was preserved.
- **Selected corpus rule, no existing file** → propose as an addition. This is how the install GROWS: every re-run re-derives tags and re-runs selection fresh, so a newly-appeared surface makes its rules newly proposable. No memory of prior runs.
- **Both exist, prose identical** → in-sync. NEVER regenerate its examples — once written they are the user's; re-tune only when the user explicitly asks.
- **Both exist, prose differs** → the user evolved the rule or the corpus moved; you cannot tell which, so show the prose diff and ask: keep theirs, take the corpus version, or keep both (theirs renamed as a local rule). Never silently overwrite.

Present the whole reconciliation as ONE compact proposal (additions / updates / preserved) and write only what the user confirms.

## Failure modes to keep loud

- Corpus unreachable / rule file unparseable → stop before writing anything.
- User declines all tags → Phase 2 still runs over the `always` candidates; say that's what happened.
- Repo has no JS/TS at all → the corpus doesn't apply; say so and install nothing.
- A selected rule with no citable evidence is a selection BUG — drop it and say so, never install on vibes.
