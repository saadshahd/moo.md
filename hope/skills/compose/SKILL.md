---
name: compose
description: Plan the skills an ask needs, invoke each as its condition arrives. Use when the ask has multiple aspects that different skills carry, or the user named multiple skills.
---

## Plan

Use a subagent for exploratory reading, keeping the main thread's context for the composition itself.

Choose the skills that matter to the ask, scaled to it — one skill per outcome. Define the stages the ask needs, within this session or across sessions; a single skill can fire more than once, at different stages. For each chosen skill, conclude its useful-when: the condition in this conversation that will call for it.

## Invoke

Work the ask, invoking each skill as the conversation reaches its condition, in dependency order:

1. Invoke it via the Skill tool. As its body loads, conclude its wrong-if — the conditions under which it refuses.
2. Emit one line before the work: `[compose] <skill> — <why, and the hoped-for outcome>`.
3. After the output, silently check the wrong-if against what came out. Speak only if it trips — one line, corrected within the same turn.

A wrong-if trip, or a turn where no chosen skill's condition fits, amends the one held belief that failed — re-derive the chosen set only if needed. The loop ends when every stage the plan defined has had its skill run, or the user stops the composing.

## Result

The worked ask is the result. Each invoked skill's output stands as that skill handed it back, in its own words.

Name what ran: the skills invoked, in the order their conditions arrived; each chosen skill whose condition did not arrive, named as not invoked; and where the user stopped the composing, the stages that did not run, named as not run rather than as unneeded. Those stages are what stays open.

The ask's words admit two readings that would build different things → use **clarify** skill, then compose over what the pick settles.
