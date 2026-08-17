---
name: shape
description: Decide the technical path once the ask is clear. Use when the WHAT is confirmed but more than one way to build it remains — architecture, technology, design.
---

## Route

Decide only among ways that differ where it matters. Look up what settles a choice without the user — their taste from CLAUDE.md and project rules, facts from the repo, docs, the web. Only choices that stay open after that route to a skill.

Route each open choice by what keeps it open, invoking the named skill with the Skill tool:

- A claim about something that exists — a library fits, the schema holds, the current design bears the load → use **judge** skill.
- The user can't choose from nothing — nothing exists to react to → use **draft** skill: the fewest versions that show a real fork, differing where it matters — who owns the data, where the seam sits, what fails how.
- The user holds taste they can't yet state → use **elicit** skill.
- Their stated preference reads two ways that would build different things → use **clarify** skill.
- They're missing something already settled about the technology → use **explain** skill.

When the work iterates — an agent loop, a refinement cycle — which loop is itself one of the choices: read `loop-selection.md`.

Each decision re-enters the routing: a resolved choice can open the next one or conflict with an earlier one; a conflict is one more choice, surfaced to the user. Route again until every open choice has the user's decision or confirmation and none conflict.

## The path

State it: each choice resolved with its reason and what was turned down, and any choice still standing open. The user owns the path.

The ask itself is still rough — starting would mean inventing what the user means → use **intent** skill.
