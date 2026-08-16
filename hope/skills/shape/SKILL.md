---
name: shape
description: Decide the technical path once the ask is clear
when_to_use: the WHAT is confirmed but more than one way to build it remains — architecture, technology, design
---

## Extract

From the conversation/context/user:

- The **ask**, confirmed — intent's work order, or as good: the WHAT the user has already settled.
- Its open **choices** — each place more than one way to build it remains, where the ways differ in what gets built.

## Gate

Proceed only when: the ask is confirmed, and more than one way to build it remains that differs where it matters.

Anything else, say which in one plain line — never decide a path anyway:

- The ask itself is still rough — starting would mean inventing what the user means → use **intent** skill.
- Only one real way exists → nothing to decide; state it and proceed with the work.

## Route

Before routing any choice: retrieve what settles it without the user — their taste from CLAUDE.md and project rules, facts from the repo, docs, the web. Only choices that stay genuinely open after retrieval route to a skill.

Route each open choice by what keeps it open, invoking the named skill with the Skill tool:

- A claim about something that exists — a library fits, the schema holds, the current design bears the load → use **judge** skill.
- The user can't choose from nothing — nothing exists to react to → use **draft** skill: the fewest versions that show a real fork, differing where it matters (who owns the data, where the seam sits, what fails how), never one approach renamed.
- The user holds taste they can't yet state → use **elicit** skill.
- Their stated preference reads two ways that would build different things → use **clarify** skill.
- They're missing something already settled about the technology → use **explain** skill.

When the work iterates — an agent loop, a refinement cycle — which loop is itself one of the choices: read `loop-selection.md`.

Each decision re-enters the routing: a resolved choice can open the next one or conflict with an earlier one; a conflict is one more choice, surfaced to the user, never silently settled. Route again until every open choice has the user's decision or confirmation and none conflict.

## Output

The technical path is the result, decided: each choice resolved with its reason and what was turned down. The user owns the path.

Then check what still stands open:

- Nothing, and a human will watch each step of the work → proceed with the work.
- The work will run without a human watching, optimizing toward something → use **target** skill before it runs.

The shaping is spent once the user owns the path — anything further runs under the branch picked here, never as another round of deciding the path.
