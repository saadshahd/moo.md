---
name: soloism
description: Use when two or more concurrent subagents are running and one finishing should immediately drive the next, or when spawned subagents go idle unnoticed, linger as stale processes the human must poll or hand-kill, or leave dependent work stalled behind them. Triggers on eager parallel dispatch, subagents that need reaping, poll-only fan-outs that never wake the orchestrator.
---

Drive concurrent subagents through solo as a distributed loop: workers coordinate and advance each other through the board; the steward verifies, merges, and reaps; the lead holds judgment and pages the human.

- Learn tools on demand, never from memory: `help(topic="timers")`, `help(topic="spawning")`, `help(topic="inspection")`.
- First call: `whoami` must return your `process_id`. No solo MCP → stop and say so.
- The fleet map lives on the board, never in your head: the scratchpad holds pid ↔ task ↔ checkpoint; whoever spawns or reaps updates it in the same turn.
- Batch independent calls in one message — parallel tool calls, never one per turn. Only a call that consumes another call's output waits for the next turn.

## Bindings (for the worker contract below)

**board** = solo todos (dependency truth: tasks, blockers, claims) + the scratchpad (fleet map, checkpoints, decisions); todos point at scratchpad sections, never duplicate them. **claim** = `todo_lock` with `lease_ttl_seconds` sized to expected runtime (the 300s default lapses silently and reads as unclaimed) — a lock dies with its owning process, so an owner no longer running means stale, not owned; `todo_complete` releases yours. **peer wake** = `send_input(process_id=<peer>, input=...)` — never at the human's feedback pane, and know it lacks compose-deferral: it can clobber a half-typed draft in any pane the human is typing in. **steward** = the standing seat's solo pid, named in every brief as the notify target. **gauge** = `get_process_output` on your own `process_id` (from `whoami`): the pane footer carries context tokens, session/weekly usage %, and the model name. Handoffs route by kind: the terminal handoff is a comment on the claimed todo; context, decisions, and the fleet map go to the scratchpad. The scratchpad is multi-writer — carry a fresh read's revision (`expected_revision`), prefer `scratchpad_append_section` to full rewrites; a conflict means re-read and re-apply, never overwrite. Successors are spawned with `spawn_agent(agent_tool_id=N)` — pick the tool from `list_agent_tools` by lane fit, launchable installations only, any lab — pass the lane's model as `extra_args=["--model", "<model>"]` (confirm it took from the spawned pane's footer), fork a checkpoint by adding `extra_args=["--resume", "<session-id>", "--fork-session"]` — then briefed with `send_input` next turn (prepend the spawn's returned `agent_instructions`; a spawn without a brief is a boot, not a dispatch). Workers hold these tools too.

<!-- doc-gen FILE src=../board.md -->
## Worker contract (embed in every brief)

The board is the shared surface the human already watches — tasks, claims, checkpoints, handoffs.

### Awareness

- On start, read the board: who else runs, what each claims, what's blocked. Your first board write records your session id (`$CLAUDE_CODE_SESSION_ID`) against your name — nobody asks a dying worker for it later.
- Claim your task mechanically (the binding's claim) before touching it. Never edit outside your claim; needing a file outside it → stop and report on the board.
- Peer-to-peer for anything mechanical: your completion unblocks a task → claim it yourself, wake the worker waiting on it, or spawn its owner — directly, never through the lead.
- Work you discover outside every lane (a bug, a gap, polish) → a ticket on the board for the steward, never a lane you invent or a message to the lead.
- Spawning your own sub-agent → carve it a narrower claim inside yours, name it in your handoff, and pass the model its lane names — mechanical work never defaults to the top tier.
- Completion notifies and handoff review go to the steward (the binding names it; no steward running → the lead). The lead is the human's pager: contact it only for ambiguity, a scope decision, blocked-on-human.
- The human's feedback surface is theirs alone: no agent ever sends input into it. Reaching the human = a board flag plus the lead paging them.
- Batch independent tool calls in one message — never one per turn.

### Handoff (durable, never terminal output alone)

- **Checkpoint** — your session id is on the board from your first write; once you've built context successors would want, add one line naming what it holds.
- **Terminal handoff** — before you finish: files changed, what you learned, what's undone — complete enough for a cold successor. It must be a deliverable you produce and verify yourself while running, never a gate only the lead opens.
- Watch your own gauge (the binding names it). Nearing compaction with the lane unfinished → write the terminal handoff now, then keep working: compaction eats what only your context holds.

### Context reuse (die freely, spawn fresh)

- No worker lingers "in case": transcripts survive death; the board and terminal handoffs are the knowledge transfer — successors cold-start from them by default.
- Fork a checkpoint only when all three hold: cache-warm (under ~1h old), light (under ~100k tokens), same lane's context. A stale or heavy fork re-ingests its whole transcript at full cost, and compaction can eat the successor's brief.
- Checkpoints are immutable: fork (`--resume <session-id> --fork-session`), never plain `--resume` (it appends to the original transcript; two resumers collide on one file). Never `--continue` (latest-in-directory is a race in a shared tree).
- Degradation: `$CLAUDE_CODE_SESSION_ID` unset → skip the checkpoint; a failed fork → cold start. Either way the terminal handoff carries the successor.
<!-- end-doc-gen -->

## The seats

Split so judgment never queues behind mechanics:

- **Lead** (top-tier model): decomposition, first-wave dispatch, gates, scope calls, collision adjudication, adopting out-of-lane edits, paging the human. Nothing routine routes here.
- **Steward** (cheap model, standing): the notify target. Verifies handoffs, merges lanes, reaps, keeps the fleet map and the net, triages tickets — human feedback and worker discoveries — into dispatchable lanes, sweeps fleet burn. Escalates to the lead only what needs judgment: a failed verify, an out-of-lane diff, a gate.
- **Feedback pane** (cheap model, standing): the human's only typing surface. No agent ever `send_input`s it. Its whole job: transcribe each human note to the board as a tagged ticket in the same turn, then wake the steward.

Fleet of ≤2 workers in one wave → spawn no extra seats; the lead holds both duties.

## The loop

### 1. Dispatch (lead)

- Spawn the steward and feedback pane first, then the initial wave in one message: `spawn_agent` per ready task, all parallel tool calls. Brief the wave in the next message: `send_input` per worker, again all in one message. A wave costs two turns — never two per worker.
- Every brief = that worker's `agent_instructions` + its lane + its model + the worker contract with bindings + the steward's `process_id` for the notify and the lead's for the pager.
- Notify contract in every brief: escalate to the lead only for human attention; after your terminal handoff and any advance you made, send exactly one informational `send_input(process_id=<steward>, input="<worker>: done|blocked — handoff at <where>, advanced <what>")`. Never progress chatter.
- Arm one safety net over the wave: `timer_set(delay_ms=600000–1200000, body=<"net sweep — fleet map in scratchpad">)`. Notifies and escalations are the wake channel; the net only catches a worker that died or went silent without notifying. The steward owns the net after dispatch.
- A worker whose environment has no solo MCP can't notify or advance — watch it with `timer_fire_when_idle_any` instead, and expect no-op wakes: idle is edge-triggered and flaps on quiet stretches mid-task.

### 2. Wake (steward)

- A notify names its sender — wake narrow: `get_process_output` on that worker only; siblings keep running unswept.
- A net fire means nobody notified — sweep every pid in the fleet map, in one message.
- Reconcile before acting: a worker may already have claimed, woken, or forked what its completion unblocked — read the board first; re-make nothing.
- A notify is a claim, the pane is the evidence — triage each output you read:
  - **completed** — the handoff satisfies the brief → step 3.
  - **exited** — stopped without satisfying it (context spent, errored, drifted off-brief) → capture what stands; redispatch the remainder fresh from what's on the board, forking its checkpoint only under the contract's fork guard. Never merge exited as done.
  - **still working** → `send_input` the reply or nudge if one is due; leave it running.
  - **stuck / errored** → `select_process(pid)` — put its terminal on the human's screen, don't describe it — and escalate to the lead with what needs deciding. Reap only once the decision no longer needs the live session.

### 3. Reap + advance the remainder (steward)

- Verify the handoff is durably where the notify says, complete enough for a cold successor; pull anything still only on the pane into the scratchpad. The worker's session id is on the board from its first write — verify it's there, never spend a turn asking for it. Closing stops and removes the process; a checkpointed transcript survives it.
- `close_process(process_id=pid)` once the handoff is captured and the worker no longer needs an interactive session. Keep any worker still producing useful work.
- If the worker has descendants, inspect them before deciding whether to close the whole group — solo asks whether to close subagents too; answer from what you inspected, never by default.
- Dispatch only what no worker advanced — the board says which unblocked tasks are still unclaimed. Don't wait for siblings.
- Integrating a lane changes the tree under still-running workers: wake each worker whose lane borders the changed files with one line on what moved.
- Update the fleet map and log any decision in the scratchpad. Never pause for approval.

### 4. Re-net + burn sweep (steward)

- Keep exactly one net live over the fleet: when the fleet map changes (new wave, reap, worker-spawned successor) or a net fires, `timer_cancel` any pending net and `timer_set` a fresh one. Repeat until the map is empty.
- Each net sweep also reads every pane's footer (the gauge) and posts one fleet-burn line to the board: per-agent context tokens, session %, weekly %. Two flags escalate to the lead: a worker near compaction with no terminal handoff on the board, and session usage nearing its limit — then quiesce deliberately: hold dispatches, re-arm the net past the reset, page the human. A stalled fleet mid-protocol is the failure; a paused fleet is the plan.

## Rotation (standing seats)

Standing seats check their own gauge at each natural pause — the steward after each reap, the lead at turn end. At 160k context tokens (hard ceiling 200k): write the rotation handoff on the board (repo state, live pids, timers, remaining flow), spawn a fresh successor on the same model — never fork it — repoint notify routes at the successor, then reap yourself. Never rotate mid-merge. The board is cold-start complete by contract; rotation is cheap, so rotate early.

## State + reporting

The human observes through solo, not through your messages. The todos and scratchpad are the live plan — written to by lead AND workers, the source of truth while work runs.

- Monitor workers through solo only (`get_process_output`, timers) — the human must never have to poll a worker themselves.
- Todos move the moment state moves — a worker claims, finishes, blocks, or forks a successor → the claim/lock and status change in the same turn, whoever acted.
- Decisions land in the scratchpad as they're made — what was decided, by which completion, and why.
- Speak to the human only when you need their input, an integration decision is ready, or reconciliation changed the plan — then say what changed. Everything else is readable at will.

## Exit

Sweep the fleet map: `close_process` every still-live pid, `timer_cancel` every pending timer. Leave zero live workers. Then close the board: refresh the scratchpad summary, set every todo status honestly, and leave a final comment on any todo a later agent may pick up. Checkpoints in the scratchpad remain valid after exit — a later session can still fork them.
