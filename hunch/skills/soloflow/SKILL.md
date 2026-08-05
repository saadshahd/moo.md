---
name: soloflow
description: Grind on one goal concurrently in a Solo workspace
disable-model-invocation: true
---

## Get up to speed, SILENTLY:

- Internalise the goal.
- Explore the project context.
- Pin the goal to the context.
- Group the files the goal touches into SCOPES
- Find what more than one scope touches: a file, a type, an ordering, a protocol, a function, etc.
- Are there any organizational changes to make delivering the goal concurrently more efficient (speed, cost, maintainability)?
  - Yes? surface them to the user in few sentences. as a bullet list of before vs after.
  - No? proceed to the next step.

IF 1 scope? say so plainly. A second lane must be worth its own warm-up and its own section in the record.

## Record it

- Pick a short `<slug>`.
- One Solo scratchpad, `name` and `tags` both `<slug>` with Sections:
  - `brief` — the goal, as a lane needs to understand it. minimal.
  - `shared` — what more than one scope touches. minimal.
  - `<slug>:<scope>` — one per lane, headed — its scope, and which shared things it owns.

Every shared thing must be owned by exactly one lane. Others stop, wait or ask before changing it.

## Lane contract

Substitute `<slug>` and `<scope>` with the lane's actual values.

```markdown
You are `<slug>:<scope>`, one of several working the same goal in parallel.

The record: is Solo scratchpad `<slug>` (`solo scratchpads read --mode section`).

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

Once you think you are done, suggest using Solo MCP to terminate all the processes you spawned including you that are no longer needed.
```

## Spawn

Prepare one `spawn_agent` per lane, with:

- `name`: `<slug>:<scope>`
- `extra_args`: `["--model", "<tier>", "<the lane contract, substituted>"]`

Invoke parallel tool use.

You - the current elected lead - NEVER work a lane.
A rejected spawn must be reported to the user and handled appropriately through suggestions of failure handling options.

## Surface progress

The env must be up and ALL the goal surfaces are running:

- does it have a clear specific surface for progress output?
- is it a repl? a storybook? a server? a playground?
- does it hot reload, does the user need to do anything you can't to keep observing progress?
- cli? use Solo MCP for terminals
- browser? use a named browser window you can control - with all the needed tabs in the same window.

The user MUST see progress ASAP and judge it internally against their expectations/mental-model.

## Pause and wait

Print, briefly:

- What should the user expect to see as a deliverable.
- Estimate when to expect the visible progress exactly.
