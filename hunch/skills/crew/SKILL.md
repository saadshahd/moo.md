---
name: crew
description: Use when dispatching two or more concurrent subagents whose work could touch overlapping files, or when concurrent delegated work needs a live answer to "who is running and what do they own".
---

Coordinate concurrent agents through one queryable registry: a task tree with hierarchical ownership plus advisory TTL leases. Allocation over locking: disjoint decomposition prevents most conflicts; leases only catch the residue.

## Learning the tool

`crew.mjs` in this skill's directory is the single source of truth. Learn it on demand — never from memory:

- `node crew.mjs help` — command overview; `help <command>` for usage and semantics.
- `node crew.mjs selftest` — prove it works here before trusting it with a run.

State lives in the OS temp dir keyed by project path (agents launched from the same directory share it; nothing lands in the project). `CREW_FILE` overrides.

## Router protocol

1. **Allocate first.** Decompose into nodes with disjoint scopes; encode known dependencies as blocked-by edges. A task whose scope overlaps everything (sync, codegen, formatting) gets a blocking edge, not a lease.
2. **Mint before spawn** (`add`), pass the printed id into the agent's prompt as `CREW_ID`, with the worker protocol below.
3. **Dispatch the `ready` frontier in parallel**; re-dispatch as edges clear. 4–6 concurrent agents, not more — throughput saturates there and the human's attention shards beyond it.
4. **Observe (`roster`, `tree`), don't poll agents.** Redirect only on conflict or stall.
5. **Verify against the claim log.** Edits outside any lease, or a forced claim, fail verification — the net enforces, nothing gates.
6. **Research fan-out:** no file scopes — the node's task text carries each agent's assigned angle, and `me` shows the others'. Portfolio over consensus: distinct angles, never the same hypothesis twice.

## Worker protocol (embed in every spawned prompt)

- Prefix every command with `CREW_FILE` and your `CREW_ID`.
- `start` then `me` on entry; `claim` before any edit; on conflict work an unclaimed part first and retry later — never force; `release` after each edit; decompose big work under your own id with `add --parent`; `done` on exit. Never edit outside your leases.

## Stances

- **Advisory over enforced:** conflicts inform with a named owner, never block — the agent reorders its own work. Compliance is measured from the claim log, not assumed.
- **Leases expire, agents go stale:** a crashed agent never wedges the crew.
