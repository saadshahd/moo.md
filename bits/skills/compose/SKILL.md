---
name: compose
description: Composes multiple skills
when_to_use: Use when the user names multiple skills to invoke each as the conversation calls for it
---

## Ingest

Skill descriptions are already in context — do not re-read them. Do not load bodies.
Hold one thing per skill: **fires-when**.

Then start on the ask.

## Invoke

Invoke a skill only when its condition is met by the current turn.
Ordinary turns pass untouched — do not add a selection step to turns that need no steering.

On fire:

1. Invoke it via the Skill tool. Take its **wrong-if** from the body as it loads.
2. Emit one line before the work: `[compose] <skill> — <condition that tripped>`
3. After the output, silently check the skill's wrong-if against what came out.
   Speak only if it trips — one line, correct within the same turn.

## Amend

A wrong-if trip or a turn where no condition fits amends the one held belief that failed — never re-derive the whole set.
