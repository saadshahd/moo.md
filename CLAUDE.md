# CLAUDE.md

## What This Is

moo — *mind on output*. A Claude Code plugin that helps humans stay present and think clearly while working with AI.

## Conventions

### Frontmatter (Required)

**Skills:**

```yaml
---
name: kebab-case-name
description: Single line. Trigger condition + what it does. Max 1024 chars.
---
```

> **Note:** Version lives in `plugin.json` only (DRY). The official Claude Code spec does not allow `version` in SKILL.md frontmatter.

**DESCRIPTION TRAP WARNING:** Skill descriptions must be **trigger-only**. If descriptions contain process summaries or workflow steps, Claude follows the short description instead of reading the detailed flowchart/instructions. Keep descriptions focused on "Use when X" patterns only.

**YAML WARNING:** Never use multi-line YAML blocks (`|` or `>`) in frontmatter. Claude Code truncates them, breaking auto-triggering.

### File Naming

- Skills: `skills/<skill-name>/SKILL.md` (kebab-case)

### File Limits

- SKILL.md: **200 lines max**
- No `references/` directories — flat files alongside SKILL.md only when essential
- Supporting files: max 3 per skill (data files like profiles, templates)
- Self-contained: SKILL.md works without loading external files
- Decision tables > prose explanations
- No inline code examples > 5 lines
- No navigation/catalog sections in skills

> **Enforcement:** these limits are discipline-only — no script checks them. The repo's one mechanical doc gate is the sync-drift guard (see Changelog → When releasing).

### Token Efficiency

- Challenge every sentence: "Does Claude need this?"
- Bullet points > paragraphs
- No vague terminology; pick one term per concept
- Use forward slashes only (`/`), never backslashes

### Skill Design (X over Y)

Phrase design decisions the way the card does — "X over Y: reason". These rules govern authoring:

**Unit choice:**

| The new thing is... | Unit |
|---|---|
| A contract that must read identically in ≥2 skills | Fragment (`<plugin>/skills/*.md`, added to sync `--files`) |
| A trigger + procedure that stands alone | Skill |
| Behavior that must run every time, deterministically | Hook |
| A judgment call only the human can initiate | Skill with `disable-model-invocation: true` |
| An unproven idea | hunch skill + `HYPOTHESIS.md`; graduates or dies |

**Build-time include over runtime reference** — behavior inlines, data references:

- doc-gen inline (build time) when content is shared behavior or contract: it must be byte-identical across consumers and resident in context — compaction and skipped reads kill references. Precedents: `card.md`, `gate.md`, `prompts.md`, `handover.md`.
- Supporting file (runtime) when content is data selected per use — a catalog or profile set where one entry loads per invocation and a skipped load degrades gracefully. Precedents: `consult/profiles/`, `target/cheat-museum.md`.
- Never reference behavior: a referenced instruction is an instruction Claude may never read.

**Model-invocable over disabled** — disable only when the trigger lives in the human's head:

- A mode the human chooses to enter (`delegate`) or a failure only the human perceives (`bro`: the model can't judge that its own message didn't land) → `disable-model-invocation: true`.
- Observable in session state (vague request → `intent`; unsupervised run → `target`) → stays model-invocable.
- On disabled skills the description is an invocation summary, not a trigger — the description trap doesn't apply.

**Composition — artifacts and priming over imports:**

- Skills never reference each other. They compose through emitted artifacts (the card) and natural-language triggers; a missing neighbor skill breaks nothing.
- New pipeline stage when the cognitive mode changes (clarify WHAT ≠ decide HOW ≠ judge unsupervised work; find ≠ fix). One skill = one mode + one gate.
- Chain mechanics: each stage ends in a gate the user locks; the card carries forward only what the next stage can't re-derive; the shared contract is a fragment doc-gen'd into every stage so each stays self-contained.
- Two skills over one when triggers differ; a shared explanation the pair needs lives in CHANGELOG, not in either skill (`bro`/`plain` precedent).

## Philosophy (Enforce These)

moo drives toward four outcomes: **reduce decision regret**, **increase conceptual clarity**, **leave fewer but stronger artifacts**, **preserve the capacity to own what you produce**. Every change to this project must serve at least one.

See `PHILOSOPHY.md` for core identity and mission.
See `hope/PHILOSOPHY.md` for hope beliefs, principles, and constraints.

### Philosophy Audit (Before Committing Changes)

- [ ] Does this add complexity without justification?
- [ ] Does this introduce persistent state?
- [ ] Could an existing skill handle this?
- [ ] Does this build something Claude does natively?
- [ ] Does this serve at least one aim: reduce regret / increase clarity / fewer artifacts / preserve ownership?

See `hope/PHILOSOPHY.md` "Hard Constraints" for plugin-specific audit items.

### Model-Judgment Boundaries (Enforce These)

A skill or hook that leans on a model's judgment (a judge, a generated artifact, an LLM check) has a correctness **rate**, not a guarantee. Its failure mode is a confident, valid-shaped wrong answer no enumerable error case names.

- NEVER claim such a boundary "works" from a single run, or model its failures as a finite set you've "handled."
- DO fence it with a deterministic check where one exists, and measure its pass-rate on a labeled set before trusting it (`seed`'s eval workspace IS this; a `slop-nudge`-style judge NEEDS it).

## Anti-Patterns

- Generic names (`*Manager`, `*Helper`, `*Utils`)
- Reference chains or deep `references/` hierarchies
- Time estimates instead of story points
- Duplicating content across docs (link to single source) — **exception:** constraints that must survive compaction repeat at point of use
- Windows paths or magic numbers in scripts
- **Process details in skill descriptions** (causes Claude to skip flowcharts)
- Inline examples longer than 5 lines
- Navigation/catalog sections in skills (tool indexes, skill tables)
- Skills over 200 lines
- Persistent work/pipeline state files (.jsonl, workflow-state.json)
- Task management APIs in skills (TaskCreate/TaskList/TaskUpdate)
- Building features Claude Code will ship natively (task management, memory, tool orchestration)
- Cargo cult process steps (ritual without reason)
- Optimizing for output volume while degrading human comprehension
- Automating friction that builds understanding (edge case exploration, consequence engagement)
- Parallel agent sessions that exceed the human's attention span (8 sessions open, 1/8 attention each)

## Changelog

Track all changes in `CHANGELOG.md` at repo root.

**When committing:**

- Add entry under `[Unreleased]` section
- Use categories: Added, Changed, Fixed, Removed
- Reference plugin name in entry (e.g., "feat(hope): ...")

**When releasing:**

- Move unreleased items to new version section
- Update version in affected plugin.json files
- Tag the release
- Run `bun run sync` and verify a clean git diff on every doc-gen consumer SKILL.md. The `sync` script's `--files` list in `package.json` is the source of truth (currently intent, shape, target, delegate, over, freeze) — read it; don't trust a hand-copied list here.
- The sync-drift guard (`.githooks/pre-push`) is the only mechanical check, and it runs **only** when `core.hooksPath=.githooks`. Verify with `git config core.hooksPath` before trusting it.
- One-time setup: `git config core.hooksPath .githooks`

**IMPORTANT:** Before any commit, check if CHANGELOG.md needs an entry. If the change is user-facing (new feature, fix, breaking change), add it.
