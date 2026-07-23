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

First live 0.0.9 session verdict: the lead was the bottleneck — a queue of mechanical coordination sitting between the human and the fleet. The founding narrow-brief stance is carved, not discarded: briefs stay narrow on the *lane*, but every worker now carries world-awareness — the worker contract (fragment `../board.md`, shared verbatim with soloism via doc-gen) has each worker read the board on start, claim mechanically, coordinate peer-to-peer for anything mechanical, and contact the lead only for the human's attention (ambiguity, scope, integration-ready, blocked-on-human). This serves the steering-latency thesis directly: the 2026-07-22 autopsies measured the binding constraint as dispatch/steering latency through the lead's turn loop, and distribution removes the lead from every path that doesn't need the human. Consistent with the CLI retirement: lane-is-the-claim is unchanged — what's new is workers *seeing* the lanes, not re-negotiating them. The contract also imports the checkpoint/fork tier (session-id checkpoints, fork-never-resume, no `--continue`), mechanism smoke-tested same day (evidence: `../soloism/HYPOTHESIS.md`, 2026-07-23).
