---
name: soloism
description: Use when two or more concurrent subagents are running and one finishing should immediately drive the next, or when spawned subagents go idle unnoticed, linger as stale processes the human must poll or hand-kill, or leave dependent work stalled behind them. Triggers on eager parallel dispatch, subagents that need reaping, poll-only fan-outs that never wake the orchestrator.
---

Drive concurrent subagents through solo as a distributed loop: workers coordinate and advance each other through the board; the lead pages the human, nets silent deaths, and reaps.

- Learn tools on demand, never from memory: `help(topic="timers")`, `help(topic="spawning")`, `help(topic="inspection")`.
- First call: `whoami` must return your `process_id`. No solo MCP → stop and say so.
- The fleet map lives on the board, never in your head: the scratchpad holds pid ↔ task ↔ checkpoint; whoever spawns or reaps updates it in the same turn.
- Batch independent calls in one message — parallel tool calls, never one per turn. Only a call that consumes another call's output waits for the next turn.

## Bindings (for the worker contract below)

**board** = solo todos (dependency truth: tasks, blockers, claims) + the scratchpad (fleet map, checkpoints, decisions); todos point at scratchpad sections, never duplicate them. **claim** = `todo_lock` — a lock dies with its owning process, so an owner no longer running means stale, not owned; `todo_complete` releases yours. **peer wake** = `send_input(process_id=<peer>, input=...)`. Handoffs route by kind: the terminal handoff is a comment on the claimed todo; context, decisions, and the fleet map go to the scratchpad. The scratchpad is multi-writer — carry a fresh read's revision (`expected_revision`), prefer `scratchpad_append_section` to full rewrites; a conflict means re-read and re-apply, never overwrite. Successors are spawned with `spawn_agent(agent_tool_id=N)` — pick the tool from `list_agent_tools` by lane fit, launchable installations only, any lab — fork a checkpoint by adding `extra_args=["--resume", "<session-id>", "--fork-session"]` — then briefed with `send_input` next turn (prepend the spawn's returned `agent_instructions`; a spawn without a brief is a boot, not a dispatch). Workers hold these tools too.

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

## The lead's loop

### 1. Dispatch

- Spawn the initial wave in one message: `spawn_agent` per ready task, all parallel tool calls. Brief the wave in the next message: `send_input` per worker, again all in one message. A wave costs two turns — never two per worker.
- Every brief = that worker's `agent_instructions` + its lane + the worker contract with bindings + your `process_id` for the pager and the notify.
- Notify contract in every brief: escalate to the lead only for human attention; after your terminal handoff and any advance you made, send exactly one informational `send_input(process_id=<lead>, input="<worker>: done|blocked — handoff at <where>, advanced <what>")`. Never progress chatter.
- Arm one safety net over the wave: `timer_set(delay_ms=600000–1200000, body=<"net sweep — fleet map in scratchpad">)`. Notifies and escalations are the wake channel; the net only catches a worker that died or went silent without notifying.
- A worker whose environment has no solo MCP can't notify or advance — watch it with `timer_fire_when_idle_any` instead, and expect no-op wakes: idle is edge-triggered and flaps on quiet stretches mid-task.

### 2. Wake

- A notify names its sender — wake narrow: `get_process_output` on that worker only; siblings keep running unswept.
- A net fire means nobody notified — sweep every pid in the fleet map, in one message.
- Reconcile before acting: a worker may already have claimed, woken, or forked what its completion unblocked — read the board first; re-make nothing.
- A notify is a claim, the pane is the evidence — triage each output you read:
  - **completed** — the handoff satisfies the brief → step 3.
  - **exited** — stopped without satisfying it (context spent, errored, drifted off-brief) → capture what stands; redispatch the remainder by forking its checkpoint if one exists and its context helps, else fresh. Never merge exited as done.
  - **still working** → `send_input` the reply or nudge if one is due; leave it running.
  - **stuck / errored** → `select_process(pid)` — put its terminal on the human's screen, don't describe it — and say what you need decided. Reap only once the decision no longer needs the live session.

### 3. Reap + advance the remainder

- Verify the handoff is durably where the notify says, complete enough for a cold successor; pull anything still only on the pane into the scratchpad. Record the worker's checkpoint (session id) in the fleet map if it didn't. Closing stops and removes the process; a checkpointed transcript survives it.
- `close_process(process_id=pid)` once the handoff is captured and the worker no longer needs an interactive session. Keep any worker still producing useful work.
- If the worker has descendants, inspect them before deciding whether to close the whole group — solo asks whether to close subagents too; answer from what you inspected, never by default.
- Dispatch only what no worker advanced — the board says which unblocked tasks are still unclaimed. Don't wait for siblings.
- Integrating a lane changes the tree under still-running workers: wake each worker whose lane borders the changed files with one line on what moved.
- Update the fleet map and log any decision in the scratchpad. Never pause for approval.

### 4. Re-net

Keep exactly one net live over the fleet: when the fleet map changes (new wave, reap, worker-spawned successor) or a net fires, `timer_cancel` any pending net and `timer_set` a fresh one. Repeat until the map is empty.

## State + reporting

The human observes through solo, not through your messages. The todos and scratchpad are the live plan — written to by lead AND workers, the source of truth while work runs.

- Monitor workers through solo only (`get_process_output`, timers) — the human must never have to poll a worker themselves.
- Todos move the moment state moves — a worker claims, finishes, blocks, or forks a successor → the claim/lock and status change in the same turn, whoever acted.
- Decisions land in the scratchpad as they're made — what was decided, by which completion, and why.
- Speak to the human only when you need their input, an integration decision is ready, or reconciliation changed the plan — then say what changed. Everything else is readable at will.

## Exit

Sweep the fleet map: `close_process` every still-live pid, `timer_cancel` every pending timer. Leave zero live workers. Then close the board: refresh the scratchpad summary, set every todo status honestly, and leave a final comment on any todo a later agent may pick up. Checkpoints in the scratchpad remain valid after exit — a later session can still fork them.
