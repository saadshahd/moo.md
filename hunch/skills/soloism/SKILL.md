---
name: soloism
description: Use when two or more concurrent subagents are running and one finishing should immediately drive the next, or when spawned subagents go idle unnoticed, linger as stale processes the human must poll or hand-kill, or leave dependent work stalled behind them. Triggers on eager parallel dispatch, subagents that need reaping, poll-only fan-outs that never wake the orchestrator.
---

Drive concurrent subagents through solo as one eager wake/reap loop. A worker's completion wakes you the instant it lands — nothing goes stale, leaks, or waits on a barrier.

- Learn tools on demand, never from memory: `help(topic="timers")`, `help(topic="spawning")`, `help(topic="inspection")`.
- First call: `whoami` must return your `process_id`. No solo MCP → stop and say so.
- Keep a private map of each task ↔ its `process_id`.
- Batch independent calls in one message — parallel tool calls, never one per turn. Only a call that consumes another call's output waits for the next turn.

## The loop

### 1. Dispatch

- Spawn the whole wave in one message: `spawn_agent(agent_tool_id=N)` per ready task, all parallel tool calls. Record task ↔ pid from each result.
- Brief the wave in the next message: `send_input(process_id=pid, input=<prompt>)` per worker, again all in one message, each prompt prepended with that worker's returned `agent_instructions`. A wave costs two turns — never two per worker.
- Every brief ends with the notify contract: your `process_id` (from `whoami`) and the rule — write your handoff durably first (scratchpad or todo), then send exactly one `send_input(process_id=<lead>, input="<worker>: done|blocked — handoff at <where>")`. Notify on done or blocked only, never progress.
- Arm one safety net over the wave: `timer_set(delay_ms=600000–1200000, body=<live pids + map + "net sweep">)`. Worker notifies are the wake channel; the net only catches a worker that died or went silent without notifying.
- A worker whose environment has no solo MCP can't notify — watch it with `timer_fire_when_idle_any` instead, and expect no-op wakes: idle is edge-triggered and flaps on quiet stretches mid-task.

### 2. Wake

- A notify names its sender — wake narrow: `get_process_output` on that worker only; siblings keep running unswept.
- A net fire means nobody notified — sweep: `get_process_output` every live pid, in one message.
- A notify is a claim, the pane is the evidence — triage each output you read:
  - **completed** — the handoff satisfies the brief → step 3.
  - **exited** — stopped without satisfying it (context spent, errored, drifted off-brief) → capture what stands, redispatch the remainder as a fresh worker. Never merge exited as done.
  - **still working** → `send_input` the reply or nudge if one is due; leave it running.
  - **stuck / errored** → `select_process(pid)` — put its terminal on the human's screen, don't describe it — and say what you need decided. Reap only once the decision no longer needs the live session.

### 3. Reap + advance

- The notify says where the handoff lives — verify it is actually there and complete before closing; pull anything still only on the pane into the scratchpad. Closing stops and removes the process, and its session and scrollback go with it.
- `close_process(process_id=pid)` once the handoff is captured and the worker no longer needs an interactive session. Keep any worker still producing useful work.
- If the worker has descendants, inspect them before deciding whether to close the whole group — solo asks whether to close subagents too; answer from what you inspected, never by default.
- Dispatch whatever this completion unblocks — back through step 1. Don't wait for siblings.
- Move the task's todo and log any decision in the scratchpad (see State + reporting). Never pause for approval.

### 4. Re-net

Keep exactly one net live over the live pid set: when the set changes (new wave, reap) or a net fires, `timer_cancel` any pending net and `timer_set` a fresh one. Repeat until no pids are live.

## State + reporting

The human observes through solo, not through your messages. The scratchpad and todos are the live plan — the source of truth while work runs, never setup artifacts that drift once dispatch starts.

- Monitor workers through solo only (`get_process_output`, timers) — the human must never have to poll a worker themselves.
- Keep todos current: each task's todo moves the moment its worker's state moves (dispatched, working, done, stuck).
- Record decisions in the scratchpad as they're made — what was decided, by which completion, and why.
- Update the plan the moment reality diverges from it: a worker discovers new context; a todo blocks or unblocks; a lane stops being worth doing; a worker changes files another worker needs to know about; verification fails and the plan needs another pass.
- Before dispatching more work, reconcile the scratchpad and todos with what the workers have learned — blockers updated first, dispatch second.
- Speak to the human only when you need their input, an integration decision is ready, or reconciliation changed the plan — then say what changed. Everything else lives in the todos and scratchpad, readable at will.

## Exit

Sweep: `close_process` every still-live pid in your map, `timer_cancel` every pending timer. Leave zero live workers.
