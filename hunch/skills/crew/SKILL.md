---
name: crew
description: Use when dispatching two or more concurrent subagents whose work could touch overlapping files, when concurrent delegated work needs a live answer to "who is running and what do they own", or when a human is observing and steering individual concurrent agents mid-flight.
---

Coordinate concurrent agents through the `crew` CLI in this skill's directory.

- Learn commands on demand, never from memory: `node crew.mjs help`, then `help <command>`.
- First use on a machine: `node crew.mjs selftest` must pass.

## Dispatching (router)

1. Decompose into nodes with disjoint scopes; encode known dependencies as blocked-by edges. A task whose scope overlaps everything (sync, codegen, formatting) gets a blocking edge, not a lease.
2. Brief each worker narrowly: one lane, one ownership boundary, one expected handoff — never the whole problem. A prompt that restates the shared goal makes every worker rebuild the whole; a prompt that names its lane and its handoff makes each worker build its part once.
3. `add` each node before spawning; pass the printed id into the agent's prompt as `CREW_ID`, with the worker rules below.
4. Dispatch the whole ready frontier in ONE message — every spawn as a parallel tool call in the same turn, never one spawn per turn. When an edge clears, re-dispatch what it unblocked in the turn that observed it. Cap concurrency at 4–6 agents.
5. Fan out at the layer that holds the decomposition: if you hold it, YOU spawn the workers. Never forward "parallelize this" to a running agent — relaying an instruction to a serial agent creates zero parallelism.
6. Ask the human only over a running fleet: dispatch everything that doesn't depend on the answer first, then ask, batching up to 4 questions per call. Never hold an idle fleet on an open question.
7. Observe with `roster` and `tree`; redirect only on conflict or stall.
8. Verify against the claim log: edits outside any lease, or a forced claim, fail verification.
9. Research fan-out: no file scopes — put each agent's assigned angle in its node's task text; never assign the same angle twice.

## Working (embed in every spawned prompt)

- Prefix every command with `CREW_FILE` and your `CREW_ID`.
- `start` then `me` on entry. `claim` before any edit; `release` after each edit. Decompose big work under your own id with `add --parent`. `done` on exit.
- Batch independent tool calls: when next steps don't depend on each other (several reads, greps, edits to different files), issue them all in one message — never one per turn.
- Claims on disjoint scopes are granted concurrently — claim your whole scope up front and run. On conflict, work an unclaimed part first and retry — never `--force`. Only when nothing unclaimed remains and the contended file truly blocks you: `claim <glob> --wait [--timeout SEC]` — never a hand-rolled `if ! claim; then sleep` loop (a shell loop cannot tell exit 3, a real conflict, from exit 127, a command that never ran).
- Invoke crew inline on every call (`node <abs>/crew.mjs ...`). Never store `node <path>` in a shell variable and call `$VAR` — zsh will not word-split it, so the command never runs (exit 127).
- Never edit outside your leases.
- Spawning your own sub-agent? Mint it a node first and set the child's `CREW_ID` to that new id — env vars inherit, and a child acting under your identity corrupts ownership.

## Human steering

- Surface the roster to the human whenever the fleet changes shape — who runs, what each owns, what's blocked — so they can aim feedback at a specific agent.
- Feedback for one worker goes to that worker directly (its own session or input channel), never relayed through the lead: a relay adds two turn-queues between the human's sentence and the edit it steers.
- The lead's job is direction and integration — set scopes, dispatch frontiers, integrate results, answer for the whole. It is not a mailbox.
