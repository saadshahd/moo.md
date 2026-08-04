# Graduated

hunch runs skills as experiments with explicit graduate and kill conditions. This file holds the
records of the ones that ran and were removed — each skill's `HYPOTHESIS.md` verbatim, as it stood
on the day it was deleted.

Nothing loads this file. It has no frontmatter and is not a `SKILL.md`; it exists to be read by a
human, or found by a search, after the code is gone.

**The records are verbatim, so their links are not.** They point at sibling skills and shared
fragments removed in the same commit, and at things that were never in this repo — a `~/Desktop`
working dir, a `soloterm.com` docs page, a memory file. Expect dead paths; that is the cost of
keeping the text unedited, and editing them would make this a summary rather than a record. The
table above is the part written to survive on its own.

## Removed in 0.0.16 — the coordination cluster

`crew`, `roster` and `soloism`. Each was removed against **its own stated bar**, separately — not
superseded, and not replaced by one successor.

| | why it was removed |
| --- | --- |
| **crew** | Its founding thesis was resolved against under measurement — 3.8× slower across three fixtures. Its description named a substrate it never fired on: zero genuine auto-selections across 32 sessions that used it. |
| **roster** | Its kill condition named the human *skipping* its approval gate. Prototyping the gate measured something worse: "yes" is one keystroke and "no" costs a full re-proposal, so the cheapest correct-looking move is approval — with every authority present. |
| **soloism** | Its own kill condition fired as written: eager dispatch outran the human's grasp. |

Why this file exists at all: at deletion these three records held **26,168 of hunch's 27,394 bytes**
of hypothesis text across nine skills. The six survivors hold one-line stubs. Deleting the code
without keeping the records would take about 96% of everything hunch has ever measured.

---

## crew

With `crew` as the steering substrate for concurrent delegated work, a human stays in command of a live fleet: the task tracker answers who runs and owns what (legibility), handoffs and lane-scoped diffs show who did what (accountability), and feedback reaches the specific worker it steers without transiting the lead's turn queue (steering latency). Software gets built the way it actually gets built — incrementally, under observation — without the human's grasp degrading as width grows.

Graduate when, across ≥5 real sessions running ≥3 concurrent agents with the human steering live: median feedback→acted-on latency beats the relay topology (human → lead turn → SendMessage → worker turn) by ≥2×; the human can answer who runs, owns what, and why at any mid-run probe; every edit falls inside its worker's declared lane, checkable from handoffs + lane-scoped diffs; and the fleet never fully idles during a human gate while dispatchable work exists. One session where the human loses grasp of the fleet, or where steering through crew is slower than just telling the lead: kill or redesign.

**Superseded bet (2026-07-22):** the original thesis — conflict-prevention collapses wall-clock ("median wall-clock ≥2× better than sequential") — resolved **against** across three fixtures (N=3, re-scoped, N=10 recursive DAG): the environment's implicit coordination (Edit stale-guard, filesystem stigmergy, read-before-write) never broke, so conflict-prevention bought no correctness and crew's ceremony cost wall-clock (v3: 3.8× worse than sequential). The surviving observed value — efficiency, accountability, legibility — is what the re-aimed thesis above bets on.

## Field notes

### 2026-07-21 — null run + legibility gap (caller: orchestrator Claude)

Setup: 5 concurrent `claude --ax-screen-reader` subagents, one self-contained generative-art HTML toy each. Disjoint file scopes, no `blocked-by` edges. 4/5 delivered; c5 abandoned. Human's verdict mid-run: *"I didn't see any communication in the crew"* + *"this is easy, not interesting."*

What actually happened: crew ran as start→claim→done ceremony only. No claim ever conflicted, no dependency edge existed, no agent ever read another's registry state. The whole coordination surface was inert.

Attribution (for later triage — is it caller / skill / outer-loop?):

- **Caller (primary).** Chose embarrassingly-parallel work: disjoint scopes + zero deps ⇒ crew degenerates to parallel `xargs`. The one thing that makes crew *do* something — contested scope or a dependency chain — was engineered away. Also never surfaced the pooled info (`roster`/`tree`/claim-log) to the watching human, so even the coordination the skill *does* model stayed invisible. Also: gated a completion watcher on 5/5 (partial = silence), and left all 5 processes running after `done`.
- **Skill (tension, by design).** Thesis is "pool information, never actions" (Nakajima) ⇒ crew intentionally has **no** agent-to-agent messaging. A human expecting "a crew that talks" experiences correct operation as *absence*. Nothing renders "coordination is happening / is deliberately unneeded" to a watching human — the claim log is machine-facing. Open Q: does crew want a **human-facing coordination story** (a legibility artifact) distinct from the registry? And it under-demonstrates interdependent work (handoffs, one agent consuming another's output) — the only regime where observation-based adaptation actually shows — with no worked example in SKILL.md.
- **Outer-loop (friction).** Solo subagents can't wake the orchestrator; coordination is poll-only, no event stream on state changes ⇒ can't react to or show coordination live. No lifecycle contract binds a node's `done` to reaping its OS process ⇒ leaked processes are the default.

Bearing on graduation: a **null run** for the speedup/compliance metrics (no conflicts, no deps exercised) and a **positive finding on a legibility gap** the current criteria don't name — "human can say who did what" passed on ownership but failed on *seeing the crew be a crew*.

### 2026-07-22 — v3 throughput-at-scale on a recursive DAG (caller: orchestrator Claude)

Setup: a purpose-built library fixture (`.crew-lab/fixture-v3/`) — `core` + 5 feature modules (15 leaf fns) + a shared barrel/registry + an integration node; 40 frozen tests; base 0%, reference solution 100%. Progress-over-time harness (`harness-v3.mjs` + `measure-v3.mjs`): per-run git isolation, freeze-check (void on tamper), a background sampler recording `{t, passPct, integrationOk}` → a per-arm curve. Three arms at scale, live Opus workers over solo/OAuth (wall-clock bound): **sequential** (1 agent), **naive** (10 agents, identical full-goal brief, zero coordination), **crew** (7-node depth-3 DAG: core → 5 parallel modules → integration, dispatched by dependency frontier with claim/done).

Results — **all three delivered 100% green + integration-coherent, 0 regressions, frozen oracle untouched, every worker reaped.** Wall-clock to 100%: **naive 41s < sequential 60s < crew 228s.** Crew was the *slowest* arm.

The falsifiable bet — *does naive thrash at 10+, or does the environment self-coordinate like it did at N=3?* — **RESOLVED: naive does NOT thrash at 10 agents.** Monotonic curve (30→45→75→95→100%), zero regressions, coherent final state. Mechanism, caught verbatim: a worker read the tree and said *"core.js and stats.js are already implemented. I'll implement the four stub modules and wire the shared surfaces."* Filesystem stigmergy + read-before-write self-coordinates the swarm; the shared barrel/registry survived 10 concurrent writers because each writer **whole-rewrites the file from current state with full visibility** → last-writer-wins loses nothing. This replicates trial-1's N=3 result at N=10.

Why crew lost on wall-clock: (1) it serializes into 3 phases, each spawning a *fresh cold-start agent wave* (~15–30s startup each) vs naive paying startup once; (2) with no thrash to prevent, crew's conflict-prevention — its whole correctness value — buys nothing; (3) the two long plateaus in the crew curve (15% for ~82s, 90% for ~98s) are barrier + cold-start + **orchestrator-in-the-loop** phase transitions (reap/spawn/brief across wake cycles). Caveat reported loudly: a fully-automated tight re-dispatcher would shrink those plateaus but not close the gap — crew still pays 3 cold-start waves for a task whose per-node compute is seconds.

What crew *did* win, on axes the human deprioritized: **efficiency** (each crew agent did exactly one file once; naive did ~10× redundant work — every agent rebuilt most of the library) and **accountability** (claim log: 7 grants, **0 forced/violations**, provable who-owned-what; naive is last-writer-wins chaos that merely happened to converge).

Bearing on graduation: crew **fails** the "median wall-clock ≥2× better than sequential" bar here — it was **3.8× worse** (228s vs 60s). Third fixture, third time the environment's implicit coordination (Edit-guard for text / FS-stigmergy for allocation / read-before-write for deps) refuses to break, even at 10 agents — so crew's conflict-prevention stays redundant for *correctness*. The demonstrated residual value is efficiency + accountability, **not** the thesis's promised wall-clock collapse. To ever surface crew's speedup you need a regime the filesystem can't implicitly coordinate: per-node work heavy enough that parallelism amortizes cold-start, OR a shared surface that **cannot be safely whole-rewritten** (true hidden in-flight state, not a small file every agent re-reads and re-emits whole). This fixture — like v1 and v2 — is not that regime.

### 2026-07-22 — two autopsies converge: the bottleneck is the lead's turn loop, not conflicts (caller: human + orchestrator Claude)

Setup: transcript-mined autopsies of (a) the **availability-cards real-project battery** — 4 sessions, Jul 20→22, 41 subagents, 1,200 main-thread events — the very session shape crew was designed for; and (b) **every crew-lab session** — 55 sessions: 3 leads, 46 headless workers, trials 1–3 + toys.

The real-project session **never invoked crew** — zero claim/lock/registry events anywhere. And nothing in it failed for lack of conflict-prevention; it failed on dispatch and steering topology:

- **The lead was a relay, not an orchestrator.** 83 SendMessage vs 36 Agent spawns; 74 of 77 S3 messages went to one serial builder. Both explicit "spawn concurrent subagents" directives produced a SendMessage *forward to that builder* — never a fan-out. The work lived two turn-queues below the human.
- **Zero tool batching, dataset-wide.** `multi_tool_msgs = 0` across 478 main-thread + 1,105 builder tool calls. The builder spent 3.9h (88% of its loop) in think/gen between one-at-a-time tools vs 31min executing them.
- **Steering paid the turn tax twice.** 54 genuine human steering prompts in one 6h session — incremental, feedback-driven development, the real usage pattern. Each hop: human prompt → lead turn (median 35s, p90 190s) → relay (median 28s, p90 148s to forward) → worker's own turn queue.
- **Human gates idled the fleet.** 60 AskUserQuestions (2.2h decision time) asked one-at-a-time, every one while zero workers ran.
- Crew-lab leads confirm the same loop cost in miniature: workers alive only 19–31% of lead wall; spawns dribbled one per model turn (mean gap 102s); ~21 poll/wake turns ≈ 9 model-minutes just to notice completions; and `claim --wait` serialized crew's own v3 arm (overlap factor 1.09 vs naive 7.42 — the substrate destroyed the parallelism it was built to protect).

Attribution: the binding constraint at every scale tried is **dispatch latency + steering latency through a turn-based single-threaded lead** — a layer crew's registry never touched. Meanwhile the human-steering pattern (observe roster, redirect one agent) is precisely what the registry can serve and currently doesn't surface.

Bearing on graduation: this note motivates the re-aim at the top of this file. SKILL.md rewritten the same day: frontier dispatched in one message, no relayed parallelism, questions asked only over a running fleet, workers batch independent tools, disjoint claims granted concurrently with `--wait` demoted to last resort, and a Human-steering section putting the lead out of the feedback path. The re-aimed thesis is UNPROVEN — no live steering session measured yet.

### 2026-07-22 — CLI retired: crew becomes a discipline skill (caller: human decision)

Same day, the lock machinery is cut entirely — `crew.mjs`, `src/`, `SPEC.md` deleted (history: hunch@0.0.7), the Working protocol replaced by brief-embedded worker rules. Three reasons, in force order:

1. **The lane is the claim.** Narrow briefs assign disjoint ownership once, at decomposition. A per-edit claim/release loop re-negotiates at runtime what the router already decided — ceremony, not coordination.
2. **Measured harm, no measured benefit.** Three fixtures, zero conflicts the environment didn't absorb; the locks' one measurable effect was serializing their own arm (`--wait`, overlap 1.09 vs 7.42).
3. **Two sources of truth.** Once the live-plan posture landed (tracker current per worker-state transition, blockers updated before dispatch), an agent-facing registry beside the human-facing tracker was DRY divergence waiting to happen — and the human only ever watches the tracker.

Named loss: proof-grade edit→agent attribution in a shared tree. The claim log was the only machine artifact mapping edit→agent; accountability now rests on handoffs + lane-scoped diffs — human-grade legibility, which is what the steering thesis needs, not forensic proof, which no trial ever needed.

Revival condition: a regime with true hidden in-flight state that whole-rewrite-from-current-state cannot absorb, or a live steering session showing a lost update the lane discipline didn't prevent. If that appears, the claim log returns from git history as a fence — not as ceremony.

### 2026-07-23 — blind workers reversed: awareness distributes to the edge (caller: human live verdict)

First live 0.0.9 session verdict: the lead was the bottleneck — a queue of mechanical coordination sitting between the human and the fleet. The founding narrow-brief stance is carved, not discarded: briefs stay narrow on the *lane*, but every worker now carries world-awareness — the worker contract (fragment `../../_fragments/board.md`, shared verbatim with soloism) has each worker read the board on start, claim mechanically, coordinate peer-to-peer for anything mechanical, and contact the lead only for the human's attention (ambiguity, scope, integration-ready, blocked-on-human). This serves the steering-latency thesis directly: the 2026-07-22 autopsies measured the binding constraint as dispatch/steering latency through the lead's turn loop, and distribution removes the lead from every path that doesn't need the human. Consistent with the CLI retirement: lane-is-the-claim is unchanged — what's new is workers *seeing* the lanes, not re-negotiating them. The contract also imports the checkpoint/fork tier (session-id checkpoints, fork-never-resume, no `--continue`), mechanism smoke-tested same day (evidence: `../soloism/HYPOTHESIS.md`, 2026-07-23).

---

## roster

With `roster` as the stage before dispatch, the plan a human hands to a fleet arrives dispatch-ready: lanes, edges, and acceptance checks already on the board, elicitation finished before fan-out instead of improvised during it. The dispatcher re-derives nothing; the human locks shape once, at one gate, and every open question is visible on the board rather than silently guessed.

Graduate when, across ≥5 real sessions where roster ran before a fleet: dispatch consumed the lanes unchanged (zero mid-dispatch lane invention); every open question on the board was answered at the gate or consciously carried; and no fleet started on an intent the human later called wrong. Kill or redesign if the human routinely skips the gate, or if roster's interview only repeats what an intent stage already extracted — then thin it to projection-only.

## Field notes

### 2026-07-23 — founding (solo workflow-docs audit)

Born from the four-doc audit of soloterm's workflow pages (grasps at `~/Desktop/solo-workflow-grasps/`, audit in session): Solo's orchestration docs are a prompt library the human must memorize and type at the lead — "Interview me until you can write a good implementation plan", "Write the plan into a scratchpad", "Create todos with blockers". The human's own live gap, verbatim: "I usually hand crew a plan but the plan doesn't have a flow roster plan." crew's router starts at decomposition-already-done; nothing owned the stage that turns intent into that decomposition durably.

Scope carves locked at founding:

- **Roster owns shape; the dispatcher owns scheduling.** Lanes, edges, acceptance, serial-rest here; cap, waves, spawn mechanics stay in the dispatch stage. The lane-disjointness rule is deliberately restated in both places — a constraint repeated at point of use, not drift.
- **Solo never leaks into tool-neutral surfaces.** The board projection names solo (scratchpad + todos) as one binding with a no-solo fallback; the shared worker contract (`../../_fragments/board.md`) is untouched by this skill's existence.
- **No duplicate interview engine.** Intent extraction is gated: skip when handed a solid plan, elicit only what the roster needs. If live use shows it re-asking what hope:intent already answered, the kill condition above fires.

---

## soloism

With `soloism` driving the loop, a subagent finishing advances the work it unblocked itself — claims it, wakes the waiting peer, or forks a successor — writes a durable handoff, and sends the lead one informational notify; the lead's job shrinks to paging the human, netting silent deaths, and reaping. The human never polls, never hand-kills a stale subagent, and never watches a ready node sit idle behind a done one. The dependency truth lives in the solo todos — written at decomposition (crew's discipline), kept current by lead and workers alike.

Graduate when, across ≥8 real sessions running ≥3 concurrent subagents with at least one real dependency edge: zero live workers survive loop exit (no leaks); zero subagents ever need a manual kill; every completion's freed dependents are advanced by the finishing worker itself — claimed, woken, or forked — with no barrier stall and no lead turn in the path (a slow sibling never delays an unrelated ready node); and the human, from the live todos and scratchpad soloism keeps current, can still say who did what and why. Kill or redesign if eager dispatch ever outran the human's grasp, or an idle-but-not-done worker was reaped and lost in-flight work.

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

### 2026-07-23 — advance distributes to workers; checkpoints make death cheap (caller: human live verdict + smoke tests)

First live 0.0.9 session verdict: the lead's turn queue was the bottleneck — mechanical coordination (routing handoffs, dispatching unblocked work) waited on it. Same-day rewrite distributes it: the worker contract (fragment `../../_fragments/board.md`, inlined here and into crew) has workers read the board on start, claim via `todo_lock`, wake peers via `send_input`, and spawn or fork successors themselves; the lead re-scopes to pager + net + reap. The done-notify survives as informational fire-and-forget — reap hygiene, never a gate on advance. The fleet map moves from the lead's private head to the scratchpad, written by whoever spawns or reaps.

Smoke-tested live before writing (three workers, all reaped): `$CLAUDE_CODE_SESSION_ID` identifies a worker's own session (undocumented, verified 2.1.218; matches transcript basename; hook-input `session_id` is the documented fallback); `spawn_agent(extra_args=["--resume","<id>","--fork-session"])` forks even a still-running session with solo identity intact (`whoami` returns the fork's own process); a fork's first turn hit ~40% prefix cache (20.6k read / 31k rewrite of a 52k context, 1h-ephemeral tier) with the full prefix cached from turn two; a killed session resumes by id with context intact. Consequence: death costs cache warmth only — kill-by-default stays, no worker ever lingers, and the checkpoint (session id + one line on the board) is the entire reuse mechanism. Rules locked from the tests: checkpoints are immutable, so successors fork and never plain-resume (two resumers collide on one transcript); `--continue` is banned in a shared tree (latest-in-directory is a race).

Named risks accepted: board rot — the human's view now rides on worker discipline, so the contract makes the board update part of *done*; claim races — closed mechanically by `todo_lock`, not by convention; a worker skipping its board read duplicates work — if that shows up live, the escalation is hook-injected board state, not louder directive wording.

### 2026-07-23 — solo workflow-docs audit: contract corroborated, gaps folded into bindings (caller: crew fan-out over soloterm.com/api/v1/docs/workflows)

Four grasp workers modeled the four workflow pages (grasps at `~/Desktop/solo-workflow-grasps/`); the audit against the soloism/crew contract in `_fragments/board.md` found the 0.0.10 contract independently corroborated — capture-before-close, board-read-on-start, narrow briefs, blockers-as-DAG, two-step spawn, summaries-as-triage all appear in solo's own docs. Gaps landed as bindings-only sharpenings (locked constraint: solo never leaks into `../../_fragments/board.md`, which crew also consumes): revision-guarded scratchpad writes (`expected_revision`, append-over-rewrite — a mechanical fence we weren't using), handoff routing (terminal handoff = todo comment; context/decisions/fleet map = scratchpad; todos point at sections, never copy), stale-lock rule (lock dies with its process; `todo_complete` releases), spawn-by-fit (`list_agent_tools` precheck, launchable only, cross-lab), integration broadcast (wake bordering workers after a lane merges), and the Exit board-close ritual (scratchpad summary, honest statuses, final comments — solo's three-update close). Parked, not built: a Stop-hook "board current?" nudge — a plugin Stop hook sits in the eliminations ledger, and the standing escalation posture above (hook-injected board state only if live sessions show the discipline skipped) already covers it. The pre-dispatch stage the docs kept scripting as human-typed prompts became its own skill: `../roster/`.

### 2026-07-30 — formal-coordination audit: two mechanisms in, two rejected (caller: audit of solo scratchpad 86 against the live-fleet record)

Four coordination literatures (structured concurrency, supervision trees, session types, blackboard) read against the shipped contract found its informal versions already implemented; what shipped from the audit is enforcement where the text asserted a property no mechanism carried, filtered by live-fleet evidence rather than by the literature's own symmetry. In: restart intensity (a lane redispatched fresh twice is structural — the counter lives in the lane's todo comments, board-held because a rotating steward's in-context count silently resets); descendant closure default flipped to close-with-parent, keep-alive now the explicit act (amends the 2026-07-22 inspect-before-deciding directive, human-locked 2026-07-30); handoff conformance redirected onto the lane's acceptance check re-run by the steward — the board-audit fleet showed a shape-perfect handoff meeting every criterion of form still carrying a false repo-state claim, so shape conformance alone verifies the wrong thing; plus the boot-brief-only fixes two fleets had validated (nested nets, rotation announce, composer-clear reap gate, re-read-your-own-writes) codified into skill text, since a hazard patched only in a live brief is patched for exactly one fleet.

Rejected, with reasons so the same reading list doesn't re-derive them: **trigger predicates** (blackboard activation) — nothing resident sleeps in a die-freely fleet; un-run work is a todo whose blockers ARE its declared trigger predicate, evaluated on every steward pass, and the integration broadcast already covers surface-touch wakes. **Retraction via reverse blocked-by traversal** — blocked-by edges are scheduling truth, not consumption truth (the integration broadcast exists precisely because consumption crosses lanes outside the edges), so reverse traversal both misses real consumers and over-invalidates sequencing-only edges; parked until a live fleet actually retracts an accepted lane.

---

