With `soloism` driving the loop, a subagent finishing notifies the orchestrator the moment its handoff lands — its process reaped, the nodes it unblocked dispatched — so the human never polls, never hand-kills a stale subagent, and never watches a ready node sit idle behind a done one. soloism owns the lifecycle loop; the dependency truth it acts on lives in the solo todos — written at decomposition (crew's discipline), kept current by this loop.

Graduate when, across ≥8 real sessions running ≥3 concurrent subagents with at least one real dependency edge: zero live workers survive loop exit (no leaks); zero subagents ever need a manual kill; every completion dispatches its freed dependents within one notify with no barrier stall (a slow sibling never delays an unrelated ready node); and the human, from the live todos and scratchpad soloism keeps current, can still say who did what and why. Kill or redesign if eager dispatch ever outran the human's grasp, or an idle-but-not-done worker was reaped and lost in-flight work.

## Field notes

### 2026-07-21 — founding (answers crew's outer-loop friction)

soloism exists to close the three outer-loop defects the crew null-run surfaced (`../crew/HYPOTHESIS.md`, same date; memory `crew-paradox-legibility-gap`): soloterm subagents can't wake the orchestrator (poll-only), a node's `done` doesn't reap its OS process (leaked by default), and nothing re-reads the ready frontier on completion. crew's ready-frontier (`../crew/src/commands.mjs`) was already eager and its SPEC already rejects barrier scheduling — the DAG was eager-capable; only the runtime that drives it was missing. soloism is that runtime, built on soloterm's native `timer_fire_when_idle_any` (the wake), `close_process` (the reap), and `send_input` (the reply). It names no coordination CLI: crew's router owns the frontier, the cap, and ownership; soloism owns the wake/reap lifecycle; they meet at the orchestrator.

Two design stances locked at founding:

- **`_any` over `_all`.** Wake on the first child to go idle, re-arm over the still-live set. `_all` reintroduces the phase barrier — the exact thing being rejected.
- **Two signals, not one.** soloterm idle triggers a *look*; the child's completion is the authoritative reap-and-advance signal. Reaping on the raw idle transition would kill children merely waiting for input. This also retires the null-run's "watcher gated on 5/5 = silence" bug — soloism reacts per idle transition, never on a count.

Unproven until the first live multi-agent run with a genuine dependency edge: nothing here has been measured, only reasoned. The standalone (no-crew) path and the eager crew-backed path both need real sessions before any rate is claimed.

### 2026-07-22 — crew CLI retired; todos become the single dependency truth

The founding note's crew machinery references (`../crew/src/commands.mjs`, "crew's router owns the frontier") describe a CLI retired the same day (see `../crew/HYPOTHESIS.md`, 2026-07-22). The split survives as discipline: crew decides lanes and blocked-by edges at decomposition and records them in the solo todos; soloism's loop keeps those todos current and dispatches from them. One dependency truth, no CLI between the two.

### 2026-07-23 — push-notify replaces the idle wake (audit of plasma-ai/fractal)

The founding wake (`timer_fire_when_idle_any` as primary) is retired: idle is edge-triggered output-quiescence and flapped once per quiet stretch in the first live 5-worker fan-out (4 of 6 wakes were mid-task blips), with no throttle in the runtime. Workers are solo-aware, so the completion signal moves to the worker itself: durable handoff first, then one `send_input` to the lead — verified live (a worker's push reached the lead's PTY as a mid-turn message in seconds). A plain `timer_set` net catches silent deaths; `_any` survives only for no-MCP workers. The founding stances hold under the flip: `_all` stays rejected (a notify is per-worker by construction), and "two signals, not one" sharpens into notify = claim, pane = evidence, with the completed/exited split (mined from the fractal audit: a worker stopped by exhaustion is exited, never merged as done). Named tradeoff: a silently-crashed worker now waits up to the net delay where the idle watch caught it in one flap. Same fan-out surfaced the durable-handoff rule now in crew: 3 of 5 pane-only handoffs scrolled off before capture.
