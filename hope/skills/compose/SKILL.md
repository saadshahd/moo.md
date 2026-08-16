---
name: compose
description: Composes multiple skills
when_to_use: the ask has multi aspects/domains or the user explicitly names multiple skills
---

## Extract

From the conversation/context/user:

- The **ask** and its aspects — the distinct domains it spans.
- The **skills** in play — the ones the user named, plus the ones whose listed conditions the ask meets.

## Gate

Proceed only when: the ask has multiple aspects that different skills carry, or the user named multiple skills.

Anything else, say which in one plain line — never compose anyway:

- One skill's condition covers the whole ask → invoke that skill alone; its procedure governs.
- The ask's words admit two readings that would build different things → use **clarify** skill, then compose over what the pick settles.

## Plan

- Use a subagent for exploratory reading, keeping the main thread's context for the composition itself.
- Choose the skills that matter to the ask, scaled to it — never two skills that deliver the exact same outcome.
- Define the stages the ask needs — within this session or across sessions. A single skill can fire more than once, at different stages.
- For each chosen skill, conclude its useful-when: the condition in this conversation that will call for it.

## Invoke

Work the ask, invoking each skill as the conversation reaches its condition, in dependency order:

1. Invoke it via the Skill tool. As its body loads, conclude its wrong-if — the conditions under which it refuses.
2. Emit one line before the work: `[compose] <skill> — <why, and the hoped-for outcome>`.
3. After the output, silently check the skill's wrong-if against what came out. Speak only if it trips — one line, corrected within the same turn.

## Amend

A wrong-if trip, or a turn where no chosen skill's condition fits, amends the one held belief that failed — re-derive the chosen set only if needed.
