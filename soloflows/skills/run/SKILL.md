---
name: run
description: Fan one goal across concurrent Solo lanes. It works out the split itself, spawns each lane with a contract to stop when work leaves its scope, and tells you in plain words what is running.
disable-model-invocation: true
---

Decide the split yourself. Ask the human nothing.

## 1. Work out the split

Read the goal, then the repo. Group the files the goal touches into **scopes**, one per lane. Then
find what more than one scope touches: a shared file, a type one defines and another uses, an
ordering, a protocol.

Compute what disk can settle. Judge the rest. Do not ask about either.

**One group → say so and end.** Do not invent a second lane.

## 2. Write the record

Pick a short `<slug>`. One Solo scratchpad, `name` and `tags` both `<slug>`, off the repo working
tree. Sections:

- `shared` — everything more than one lane touches
- one per lane, headed `<slug>:<scope>` — its scope, and which shared things it owns

**Every shared thing is owned by exactly one lane.** The rest stop and ask before changing it.

## 3. Spawn each lane

One `spawn_agent` call per lane, carrying everything. Never call `send_input`.

- `name`: `<slug>:<scope>`
- `extra_args`: `--model <tier>`, and the contract below as the lane's first turn

## 4. Say what is running

Plain sentences. No table, no jargon, no rationale. What each lane is doing, what they share, and
that they will stop before touching anything outside it. Then stop.

## The contract

Substitute `<slug>` and `<scope>`. Nothing else is ever sent to a lane.

```markdown
You are lane `<slug>:<scope>`, one of several working the same goal in parallel.

**The record** is Solo scratchpad `<slug>` (`solo scratchpads read --mode section`).
Read section `<slug>:<scope>` — your scope, and the shared things you own — and the
`shared` section. Read nothing else in it: other lanes' sections are not yours.
Re-read both before every commit; they change while you work.

**Stop and ask, here in this pane, before you act** when either is true:

- your work needs to touch anything outside your scope, or would change something
  in the `shared` section that you do not own. Your own scope is yours; nothing else is.
- you cannot close a question from what you have. A stop you did not need costs one
  keystroke; a guess you should not have made costs this lane.

When the answer changes something shared, append it to the `shared` section with the
revision you read. If the write is rejected as a revision mismatch, another lane
amended first: re-read, re-decide, write again.

Do not close this process. It is closed from outside, once your work has been read.
```
