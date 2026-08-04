---
name: soloflow
description: Grind on one goal concurrently in Soloterm workspace
disable-model-invocation: true
---

## Get up to speed, SILENTLY:

- Internalise the goal.
- Explore the project context.
- Pin the goal to the context.
- Group the files the goal touches into SCOPES
- Find what more than one scope touches: a file, a type, an ordering, a protocol, a function, etc.
- Are there any organizational changes to make delivering the goal concurrently more efficient(speed, cost, maintainability)?
  - Yes? surface them to the user in few sentences. as a bullet list of before vs after.
  - No? proceed to the next step.

IF 1 group? say so plainly. Do not invent a second lane that doesn't satisfy the cost/ceremony/lane warming up.

## Record it

- Pick a short `<slug>`.
- One Solo scratchpad, `name` and `tags` both `<slug>` with Sections:
  - `brief` — everything more than one lane must be aware of. minimal.
  - `shared` — everything more than one lane must be aware of. minimal.
  - `<slug>:<scope>` — one per lane, headed — its scope, and which shared things it owns.

Every shared thing must be owned by exactly one lane. Others stop, wait or ask before changing it.

## Lane contract

Substitute `<slug>` and `<scope>` with the lane actual values.

```markdown
You are `<slug>:<scope>`, one of several working the same goal in parallel.

The record: is soloterm scratchpad `<slug>` (`solo scratchpads read --mode section`).

- Read the goal `brief` section.
- Read `<slug>:<scope>` section.
- Read the `shared` section.

Re-read the `shared` section before every commit; it changes while you work.

Stop and ask, before you act when any is true:

- you cannot close a question/ambiguity from what you have.
- you need to change or suggest changing anything outside your scope.
- another agent is overstepping your scope, and blocking you from running your plan successfully.

When the answer changes something shared, append it to the `shared` section with the
revision you read. If the write is rejected as a revision mismatch, another lane
amended first: re-read, re-decide, write again.

Once you think you are done, suggest using solo mcp to terminate all the processes you spawned including you that are no longer needed.
```

## Spawn

Prepare one `spawn_agent` per lane, with:

- `name`: `<slug>:<scope>`
- `extra_args`: `["--model", "<tier>", "<the lane contract, substituted>"]`

Invoke parallel tool use.
