---
name: moo-authoring
description: Use when adding or changing a skill, hook, or runtime file in this repo — including deciding which unit a new capability should be.
metadata:
  internal: true
---

Doctrine for authoring moo's own surfaces.

## Frontmatter

No `when_to_use`.

A condition that follows what the skill does is marked `Use when <condition>.`
A description may also open with the condition and stop there, where naming the capability would discriminate nothing.

A skill that stays in this repo declares `metadata.internal: true`.

Version lives in `plugin.json` only. Claude Code spec does not allow `version` in SKILL.md frontmatter.

## Sizing

- Size a skill by a deletion pass using a /reduce loop, never a numeric cap.
- Decision tables > prose explanations.

## Efficiency

- Challenge every sentence: "Does Claude need this?"
- Bullets for enumerable items; a paragraph when the point is one connected argument.
- No vague terminology; pick one term per concept.

## Skill Design

Phrase design decisions as "X over Y: reason".

**Unit choice** — behavior inlines at build, data references at runtime; a skill's firing is probabilistic, so behavior that must run every time is a hook:

| The new thing is...                                  | Unit                                               |
| ---------------------------------------------------- | -------------------------------------------------- |
| Data selected per use (catalog, profile, corpus)     | Runtime file                                       |
| A trigger + procedure that stands alone              | Skill                                              |
| A trigger only the human perceives                   | Skill with `disable-model-invocation: true`        |
| Behavior that must run every time, deterministically | Function hook aka claude code mods                 |
| An unproven idea                                     | hunch skill + `HYPOTHESIS.md`; graduates or dies   |
| Doctrine for this repo's own surfaces                | Repo-local skill in `.claude/skills/`; never ships |

Before building any unit, count how often its target situation occurs in real session transcripts, and weigh each case by what the miss cost. A rare, cheap situation caps the value whatever the build's accuracy; a planted test prompt proves the mechanism, never the value.

**Composition — name-calls, never imports:**

- Skills compose by name: a composer names a move and invokes it with the Skill tool; a body never inlines another body.
- New skill when the cognitive mode changes (clarify WHAT ≠ decide HOW ≠ judge unsupervised work; find ≠ fix). One skill = one mode + one gate.
- Two skills over one when triggers differ; a shared explanation the pair needs lives in this file, which owns skill-design reasoning, not in either skill.
- A body names a sibling in exactly two places: a refusal, and a route — wherever in the body those sit. There the name _is_ the refusal's or the route's content, and a reader without it is stranded.
- Ending over hand-off: a finished run states what is now settled and what is still open, in its own words. Naming who handles it next hardcodes the graph n², so one trigger change edits every sibling.

**Turning to the user — information decides who is asked, never the skill's habit.** A skill states once, over every point where it asks or hands something over, `only what nothing in reach settles; read what does, and say where its answer came from`, in those words. In reach: the repo, its docs and history, the record, the user's notes and accounts, and any read-only tool the session has, read at the source that settles the fact. A step that is free, reversible and inside the work is done and its result reported, never handed over as a link, path or command. What stays the user's:

| Turn to the user for                                                                        | Unless                                                                              | The turn carries                                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| What only they hold — what they want, their reasons, taste and limits, what they understand | A wrong guess costs less to undo than the question costs: state it, they correct it | What was read, so they answer only what is left               |
| An act only their login or authority can take                                               | —                                                                                   | The work done: values filled, request drafted, one exact step |
| An act that spends their money or time, reaches outside the work, or can't be undone        | Their words, this session or recorded in reach, authorize that act and its content  | The act ready to run on their yes                             |

A fact out of reach is named as a gap wherever a claim or choice rests on it.

**Output form — bound by what the skill hands back, never by one shared sentence.** Plain words is the only part that holds across all three:

| The Output hands back                                                            | Bound it by                                                                                                    |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Something the agent restated in its own words                                    | As short as it goes with nothing _the skill can't afford to drop_ lost — name that thing, it differs per skill |
| The user's own words — a record, an amended proposal                             | Preserving them. A compression clause here destroys the result                                                 |
| A structure the reader navigates — verdict then evidence, a case set then a rule | Bounding each part where a reader would pad it, never the whole                                                |

A cap counted in lines is a compression budget on a handed-back artifact — replace it. A cap on one turn of a loop is pacing, and the rest arrives on the user's next pull — keep it.

## Hook Design

Every hook is a function hook: it reaches the human with no model turn. The API is early access; `plugin-authoring` and `/plugin-types` are the reference for every event and call.

- A hook never starts a turn the human didn't ask for: no wake, no `$.prompt.submit` of its own.
- What a hook finds waits where the human looks next, the band above the prompt, and appears there only while it holds something. Detail unfolds on a press and folds back.
- A hook hands to Claude only on the human's Enter: `$.prompt.fill` a sentence start they finish, with any bulk added as `prompt.submit` context.
- Work longer than one dispatch runs unawaited, so the turn's end is never held.
- State lives in `$.state` (this session) or `$.store` (across sessions), never in temp files. Module variables hold only what a hot reload may drop: it drops them.
- A failure shows once, as a toast, and the event passes on.
- A pane or band is verified on events copied from real session transcripts, one per shape it renders; a synthetic event alone never verifies it.
- One hooks module per plugin; a second part composes into it. A second registration on the same event and matcher in one plugin is dropped silently.

A hook that spawns headless `claude -p` copies its flag set from `hope/hooks/judge.sh`, where each flag is commented at the point of use.
