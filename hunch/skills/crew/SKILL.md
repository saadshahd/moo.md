---
name: crew
description: Use when dispatching two or more concurrent subagents whose work could touch overlapping files, when concurrent delegated work needs a live answer to "who is running and what do they own", or when a human is observing and steering individual concurrent agents mid-flight.
---

Discipline for running concurrent agents in one working tree with a human steering. Ownership is decided once, at decomposition — never negotiated at runtime.

## Dispatching (router)

1. Decompose into lanes with disjoint scopes; record each lane and its blocked-by edges in the task tracker the human already observes. A task whose scope overlaps everything (sync, codegen, formatting) runs behind a blocking edge, never concurrently.
2. Brief each worker narrowly: one lane, one ownership boundary, one expected handoff — never the whole problem. A prompt that restates the shared goal makes every worker rebuild the whole; a prompt that names its lane and its handoff makes each worker build its part once.
3. Dispatch the whole ready frontier in ONE message — every spawn as a parallel tool call in the same turn, never one spawn per turn. When an edge clears, re-dispatch what it unblocked in the turn that observed it. Cap concurrency at 4–6 workers.
4. Fan out at the layer that holds the decomposition: if you hold it, YOU spawn the workers. Never forward "parallelize this" to a running agent — relaying an instruction to a serial agent creates zero parallelism.
5. Ask the human only over a running fleet: dispatch everything that doesn't depend on the answer first, then ask, batching up to 4 questions per call. Never hold an idle fleet on an open question.
6. Verify each handoff against its declared lane: diff the lane's files against what the handoff claims. An edit outside any declared lane fails verification and goes back to its worker.
7. Research fan-out: no file lanes — put each worker's assigned angle in its brief; never assign the same angle twice.

## Worker rules (embed in every brief)

- Never edit outside your lane. If your task needs a file outside it, stop and report — don't take it.
- Batch independent tool calls: when next steps don't depend on each other (several reads, greps, edits to different files), issue them all in one message — never one per turn.
- Spawning your own sub-agent? Carve it a narrower sub-lane inside yours and name it in your handoff — ownership stays traceable through you.
- End with a handoff: files you changed, what you learned, what you left undone.

## Human steering

- Surface the fleet to the human whenever it changes shape — who runs, what each owns, what's blocked — so they can aim feedback at a specific worker.
- Feedback for one worker goes to that worker directly (its own session or input channel), never relayed through the lead: a relay adds two turn-queues between the human's sentence and the edit it steers.
- The lead's job is direction and integration — set lanes, dispatch frontiers, verify handoffs, answer for the whole. It is not a mailbox.
