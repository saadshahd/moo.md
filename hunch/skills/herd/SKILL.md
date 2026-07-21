---
name: herd
description: Use when dispatching two or more concurrent subagents whose work could touch overlapping files, or when delegated work needs a live answer to "who is running and what do they own".
---

Coordinate concurrent agents through one queryable registry: a task DAG with hierarchical ownership plus advisory resource claims. Allocation over locking: disjoint decomposition prevents most conflicts; claims only catch the residue.

## The registry

One JSON file (`HERD_FILE`, default `./.herd/registry.json`), driven by `herd.mjs` in this skill's directory. Runner-agnostic: any process with shell access participates — native subagents, other CLIs, other harnesses. Ephemeral: the registry dies with the run; delete `.herd/` at wrap-up.

Node IDs are hierarchical (`h1`, `h1.2`, `h1.2.1`): owning a node = owning its subtree. Any agent may decompose its own node further — it becomes the DAG owner of that slice.

## Router protocol

1. **Allocate first.** Decompose into nodes with disjoint `--scope` globs; encode known dependencies as `--blocked-by` edges. A task whose scope overlaps everything (sync, codegen, formatting) gets a blocking edge, not a lock.
2. **Mint before spawn.** `herd add` each node; pass the id into the agent's prompt with the worker protocol below.
3. **Dispatch the ready frontier** (`herd ready`) in parallel; re-dispatch as edges clear.
4. **Observe, don't poll agents.** `herd roster` and `herd tree` show live ownership; redirect only on conflict or stall.
5. **Verify against the claim log.** The verify-agent checks edits stayed inside claims (`events.jsonl` + diff). Edits outside any claim, or a `forced` claim → NOGO. The net enforces; nothing gates.
6. **Research fan-out:** no file scopes — the node's task text carries each agent's assigned angle instead, and `me` shows the others' angles. Portfolio over consensus: distinct angles, never the same hypothesis twice.

## Worker protocol (embed in every spawned prompt)

- Every command prefixed: `export HERD_FILE=<path> HERD_ID=<your-id>`.
- `herd start` then `herd me` on entry — who you are, your subtree, other live agents, their claims.
- Claim before edit: `herd claim '<glob>' --ttl 900`. Exit 3 = conflict; JSON names the owner.
- On conflict: work an unclaimed part first, retry later. Never `--force`.
- Big task? Decompose under yourself: `herd add "..." --parent $HERD_ID`.
- `herd release` after each edit; `herd done` on exit. Never edit outside your claims.

## Commands

| Command | Does |
| --- | --- |
| `add "task" [--parent id] [--scope g] [--blocked-by ids]` | mint node, prints id |
| `start` / `beat` / `done` / `fail` | lifecycle + heartbeat (id from `HERD_ID`) |
| `me` | identity, lineage, subtree, other live agents, potential conflicts |
| `roster` | live agents + claims + subtrees |
| `tree` / `ready [--under id]` | DAG view / unblocked frontier |
| `claim <glob> [--ttl s] [--shared]` | advisory lease; exit 3 + owner on conflict |
| `release [glob]` / `block <id> --on <id>` / `json` | drop lease / add edge / dump |

## Stances

- **Advisory over enforced:** conflicts inform, never block — the agent reorders its own work. Compliance is measured (`events.jsonl`), not assumed; the verify-net catches violations after the fact.
- **Claims expire, agents go stale:** TTL leases and heartbeat liveness mean a crashed agent never wedges the herd.
- **4–6 concurrent agents, not more:** throughput saturates there, and beyond it the human's attention shards (see SPEC.md evidence). Concurrency serves the human's clock, never outruns their grasp.
