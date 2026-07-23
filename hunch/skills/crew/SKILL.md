---
name: crew
description: Use when dispatching two or more concurrent subagents whose work could touch overlapping files, when concurrent delegated work needs a live answer to "who is running and what do they own", or when a human is observing and steering individual concurrent agents mid-flight.
---

Discipline for running concurrent agents in one working tree with a human steering. Ownership is decided once, at decomposition; coordination after that runs worker-to-worker, with the lead reserved for the human's attention.

## Dispatching (router)

1. Decompose into lanes with disjoint scopes; record each lane and its blocked-by edges on the board. A task whose scope overlaps everything (sync, codegen, formatting) runs behind a blocking edge, never concurrently.
2. Brief each worker narrowly: one lane, one ownership boundary, one expected handoff — never the whole problem. Every brief embeds the worker contract below with crew's bindings.
3. Dispatch the whole ready frontier in ONE message — every spawn as a parallel tool call in the same turn, never one spawn per turn. Cap concurrency at 4–6 workers. When an edge clears, the worker that cleared it advances the unblocked work itself (see contract); the lead re-dispatches only what no worker picked up, in the turn that observed it.
4. Fan out at the layer that holds the decomposition: if you hold it, YOU spawn the workers. Never forward "parallelize this" to a running agent — relaying an instruction to a serial agent creates zero parallelism.
5. Ask the human only over a running fleet: dispatch everything that doesn't depend on the answer first, then ask, batching up to 4 questions per call. Never hold an idle fleet on an open question.
6. Verify each handoff against its declared lane: diff the lane's files against what the handoff claims. An edit outside any declared lane fails verification and goes back to its worker.
7. Research fan-out: no file lanes — put each worker's assigned angle in its brief; never assign the same angle twice.

## Bindings (for the worker contract below)

Crew's bindings: **board** = the task tracker the human already watches plus durable handoff files; **claim** = your declared lane, recorded on the board at decomposition (the lane is the claim); **peer wake** = the worker's own input channel if it has one, else a board note it reads; **spawn** = a `claude` subprocess via Bash (`--resume <id> --fork-session` forks a checkpoint) — a spawn surface that can't resume cold-starts successors from the terminal handoff.

<!-- doc-gen FILE src=../board.md -->
## Worker contract (embed in every brief)

The board is the shared surface the human already watches — tasks, claims, checkpoints, handoffs.

### Awareness

- On start, read the board: who else runs, what each claims, what's blocked.
- Claim your task mechanically (the binding's claim) before touching it. Never edit outside your claim; needing a file outside it → stop and report on the board.
- Peer-to-peer for anything mechanical: your completion unblocks a task → claim it yourself, wake the worker waiting on it, or spawn/fork its owner — directly, never through the lead.
- Spawning your own sub-agent → carve it a narrower claim inside yours and name it in your handoff; ownership stays traceable through you.
- The lead is the human's pager. Contact it only for what needs the human: ambiguity, a scope decision, integration ready for review, blocked-on-human.
- Batch independent tool calls in one message — never one per turn.

### Handoff (durable, never terminal output alone)

- **Checkpoint** — when you've built context successors will want (exploration done, before task-specific work): write your session id (`$CLAUDE_CODE_SESSION_ID`) plus one line naming what the context holds to the board.
- **Terminal handoff** — before you finish: files changed, what you learned, what's undone — complete enough for a cold successor. It must be a deliverable you produce and verify yourself while running, never a gate only the lead opens.

### Context reuse (die freely, fork precisely)

- No worker lingers "in case": transcripts survive death; the checkpoint is the reuse mechanism.
- Need a checkpoint's context? Fork it: launch the successor through the binding's spawn mechanism with `--resume <session-id> --fork-session`.
- Checkpoints are immutable: fork, never plain `--resume` (it appends to the original transcript; two resumers collide on one file). Never `--continue` (latest-in-directory is a race in a shared tree).
- Degradation: `$CLAUDE_CODE_SESSION_ID` unset → skip the checkpoint; a failed fork → cold start. Either way the terminal handoff carries the successor.
<!-- end-doc-gen -->

## Human steering

- Surface the fleet to the human whenever it changes shape — who runs, what each owns, what's blocked — so they can aim feedback at a specific worker.
- Feedback for one worker goes to that worker directly (its own session or input channel), never relayed through the lead: a relay adds two turn-queues between the human's sentence and the edit it steers.
