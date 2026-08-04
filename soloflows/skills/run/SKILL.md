---
name: run
description: Fan one goal across concurrent Solo lanes. You rule on the seams; each lane is spawned with them and a contract to stop when work leaves what you agreed.
disable-model-invocation: true
---

Minimise the rulings the human makes.

## 1. Scopes and couplings

Read the goal, then the repo. Propose candidate **scopes** — groups of files the goal touches — and
compute what couples them.

- **Verifiable** — two scopes write one file, import across, or share a declared type. Computable
  against disk.
- **Behavioural** — the dependency is real but has no shared artifact: an output shape another
  scope assumes, an ordering, a protocol.

**One top-level group → say so and end.** Do not invent a second lane.

## 2. Show the surface

Once. It carries:

- candidate scopes, with a **model** column — `--model` is settable only at spawn
- every **verifiable** coupling, displayed and never asked
- every **behavioural** coupling, asked: *is this a seam?*

**Never ask the human to approve the scopes.** Edit them freely.

**Ruling a coupling not-a-seam must merge its two scopes into one lane.** If derived lanes always
equal the proposed scopes, this step did nothing — check every run.

## 3. Write the record

Derive lanes from the ruled seams. Pick a short `<slug>`.

One Solo scratchpad, `name` and `tags` both `<slug>`, off the repo working tree. Sections:

- `seams` — what was ruled, and what crosses lanes
- one per lane, headed `<slug>:<scope>` — its scope and the seams it owns

## 4. Spawn each lane

One `spawn_agent` call per lane, carrying everything. Never call `send_input`.

- `name`: `<slug>:<scope>`
- `extra_args`: `--model <tier>`, and the contract below as the lane's first turn

Then stop. Print nothing.

## The contract

Substitute `<slug>` and `<scope>`. Nothing else is ever sent to a lane.

```markdown
You are lane `<slug>:<scope>`, one of several working the same goal in parallel.

**The record** is Solo scratchpad `<slug>` (`solo scratchpads read --mode section`).
Read section `<slug>:<scope>` — your scope and the seams you own — and the `seams`
section. Read nothing else in it: other lanes' sections are not yours.
Re-read both before every commit; they change while you work.

**Stop and ask, here in this pane, before you act** when either is true:

- your work needs to touch anything outside your scope, or would change a seam —
  an interface, a shared contract. Interiors are yours; nothing else is.
- you cannot close a question from what you have. A stop you did not need costs one
  keystroke; a guess you should not have made costs this lane.

When the answer changes a seam, append it to the `seams` section with the revision you
read. If the write is rejected as a revision mismatch, another lane amended first:
re-read, re-decide, write again.

Do not close this process. It is closed from outside, once your work has been read.
```
