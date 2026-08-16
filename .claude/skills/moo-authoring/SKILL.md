---
name: moo-authoring
description: Use when adding or changing a skill, hook, or runtime file in this repo — including deciding which unit a new capability should be.
---

Doctrine for authoring moo's own surfaces.

## Frontmatter

A skill's frontmatter carries `name` and `description`; read any shipped `SKILL.md` for the current key set. The description is one line, and Claude Code caps it at 1024 characters.

Version lives in `plugin.json` only (DRY). The official Claude Code spec does not allow `version` in SKILL.md frontmatter.

## Sizing

- Size a skill by a deletion pass, never a numeric cap.
- Put branch-specific content in files the skill opens when the branch is taken, and name them where they are needed.
- Decision tables > prose explanations.

## Token Efficiency

- Challenge every sentence: "Does Claude need this?"
- Bullets for enumerable items; a paragraph when the point is one connected argument.
- No vague terminology; pick one term per concept.

## Skill Design

Phrase design decisions as "X over Y: reason".

**Unit choice** — behavior inlines at build, data references at runtime; a skill's firing is probabilistic, so behavior that must run every time is a hook:

| The new thing is... | Unit |
|---|---|
| Data selected per use (catalog, profile, corpus) | Runtime file |
| A trigger + procedure that stands alone | Skill |
| A trigger only the human perceives | Skill with `disable-model-invocation: true` |
| Behavior that must run every time, deterministically | Hook |
| An unproven idea | hunch skill + `HYPOTHESIS.md`; graduates or dies |

**Composition — name-calls, never imports:**

- Skills compose by name: a composer names a move and invokes it with the Skill tool; a body never inlines another body.
- New skill when the cognitive mode changes (clarify WHAT ≠ decide HOW ≠ judge unsupervised work; find ≠ fix). One skill = one mode + one gate.
- Two skills over one when triggers differ; a shared explanation the pair needs lives in CHANGELOG, not in either skill.

## Hook Design

Hooks run beside the thread, never in front of it — they never gate.

Mode = two questions: does the foreground need the result, and now?

| Mode | When |
|---|---|
| Sync inject | Few lines of framing, computed instantly |
| `async` — fire-and-forget | Side effect only; surfaces as a file change, never re-engages the thread |
| `asyncRewake` — fire-and-maybe-wake | Off-thread check; exit 2 wakes Claude on a finding, exit 0 stays silent |

A hook that spawns headless `claude -p` copies its flag set from the two shipped hooks, where each flag is commented at the point of use (`hope/hooks/judge.sh`, `hope/hooks/memory-write.sh`), and keeps its verdict logic in one file shared with its eval harness.
