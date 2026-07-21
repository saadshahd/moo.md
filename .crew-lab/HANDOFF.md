# TICKET — crew concurrency benchmark (delegating run)

**Goal:** measure whether crew-coordinated concurrent coding agents are *fast like naive
parallelism but correct like sequential* — i.e. test crew's HYPOTHESIS (≥2× wall-clock vs
sequential, ~zero collisions) on a real read/write/develop task, not a search proxy.

**Run as:** a delegating session using the **crew** skill (`hunch:crew`) + the **solo** skill
(`hunch/skills/solo` — eager spawn/reap loop). You are the orchestrator; you spawn worker
agents per arm, drive them, reap them eagerly, and record deterministic metrics. You do NOT
write feature code yourself — the workers do.

---

## Lab layout (all under `.crew-lab/`)

- `fixture/` — pristine task repo (pure Node, no deps). 6 features + 1 global middleware task; oracle in `tests/contract.test.js` (19 tests). Base = all fail; done = all pass.
- `harness.mjs` — `setup <trial> <arm>` (fresh git checkout → `run-<trial>-<arm>/`), `freezecheck <dir>`, `record <trial> <arm> <dir> <wallMs>` (freeze-check + measure + append row, void on tamper/error), `summary`.
- `measure.mjs` — deterministic metrics from a trial's FINAL state (never trusts an agent). Emits `correct`, `lostHotFileEdits` (collision signature), `handlersBuilt`, etc.
- `results.jsonl` — one row per arm-run. Baseline row already present (sequential, valid, correct).

Frozen files (agents must never touch; tamper → trial VOID): `tests/`, `src/registry.js`, `src/app.js`.
Hot files (the contested surfaces): `src/index.js` (barrel), `src/manifest.js`, `src/middleware.js`.

---

## LOCKED target contract

- **Observable:** count of *valid* trials in `results.jsonl` (valid = all 3 arms terminal on a fresh fixture, frozen files untouched, measure clean).
- **Verify command:** `node harness.mjs record <trial> <arm> <dir> <wallMs>` — appends a row only if valid; exits non-zero otherwise.
- **Baseline (measured, gate PASSES):** sequential arm, 1 agent, ~35s wall, ~52k tokens, `correct:true, lostHotFileEdits:0`.
- **Bound:** whichever first — **N valid trials**, OR a **wall-clock cap**, OR the **spend-capped key** exhausts. Set N from the key (see cost model).
- **Guards** (violation → VOID, not a low score): pristine start hash; frozen files unchanged; all agents reaped.
- **Cheats closed:** *edit the test* → freeze-check voids; *stub handle()/drop the dup-route guard* → app.js+registry.js frozen; *log a crashed trial* → no row unless all arms terminate+measure clean; *claim done untested* → harness runs the oracle itself.

**Pre-flight (human, before unsupervised run):** issue a disposable API key with a provider-side
spend cap (the contract bounds correctness; only the key bounds cost). Babysit trial 1, confirm
it uses the harness instruments, then leave.

---

## The battery (per trial `t`, accumulate a rate)

For each arm in **[sequential, naive, crew]**:

1. `node harness.mjs setup t <arm>` → prints `{dir, baseline}`.
2. Stamp `start = Date.now()`. Spawn the arm's workers (solo skill: `spawn_agent(agent_tool_id=5, extra_args=["--ax-screen-reader"])`, then `send_input` the brief). Eager-reap: wake on each worker going idle (watch the trial go green via `measure.mjs`, or `get_process_status`), reap with `close_process`. Cap 4–6 concurrent.
3. When all workers terminal, stamp `end = Date.now()`; `wallMs = end - start`.
4. `node harness.mjs record t <arm> <dir> <wallMs>`.
5. Reap every worker; `rm -rf run-t-<arm>`.

Check bound after each trial. At end: `node harness.mjs summary`, then compute the rate.

### Arm briefs (worker prompts — single-line each when sent)

**sequential** — 1 worker: *"Working dir `.crew-lab/run-t-sequential`. Read TASK.md, implement the ENTIRE task solo until `node --test tests/*.test.js` is 19/19. FROZEN: tests/, src/registry.js, src/app.js. Print DONE and stop. Autonomous."* (proven)

**naive** — 3 workers, NO coordination. a1={users,orders}, a2={products,carts}, a3={reviews,payments}; ALL three also told to add the logging middleware. Brief: *"Working dir `.crew-lab/run-t-naive`. Implement features <X,Y>: for each, create src/handlers/<name>.js, add its import to src/index.js, add its name to src/manifest.js. ALSO add the requestId logging middleware to src/middleware.js. FROZEN: tests/, registry.js, app.js. Work independently; you cannot talk to the others. Autonomous."* (they clobber index.js/manifest.js/middleware.js → collisions)

**crew** — 3 workers + crew. Orchestrator mints nodes BEFORE spawning: 6 feature nodes (scope = each handler file) + hot-file coordination + 1 global node `blocked-by` the 6 features. Same 2-features-per-agent split; the global middleware is its own node dispatched only after features land. Brief adds crew protocol: *"You are crew worker <CREW_ID>. Before editing a hot file (src/index.js, src/manifest.js, src/middleware.js): `claim` it, edit, `release`. On conflict, do other work and retry — never --force. Handler files are yours alone. `done` on exit."* (leases serialize hot-file edits → no lost writes; dep edge orders the global task)

---

## Cost model + bound

Measured: **~52k tokens / worker** for this task. Per full trial ≈ sequential(1) + naive(3) + crew(3) ≈ **~350–450k tokens** (+ orchestration). So:

    N_trials  ≈  key_token_budget / ~450k

Pick N so the spend-capped key covers it with headroom. Crew's HYPOTHESIS wants ≥10 trials; do
what the key allows and note the shortfall loudly — a partial rate is still evidence.

## Reading the rate (analysis, after the run)

Per arm across valid trials: **median wallMs**, **correctness rate** (% correct), **mean lostHotFileEdits**.

- crew speedup = median(sequential wall) / median(crew wall) — target ≥2×.
- collision delta = mean(naive lost) vs mean(crew lost) — expect naive > 0, crew ≈ 0.
- crew's claim holds iff crew is ~as fast as naive AND ~as correct as sequential (naive should be fast-but-wrong).

## Failure modes (fail loud)

1. Worker hangs/API-loops → per-worker idle timeout + reap; trial with an unreaped worker is VOID.
2. Flaky measure → `probeError` non-null voids the row; never count it.
3. Fake-green → freeze-check + harness-run oracle already close this; if a new cheat appears, fix the *contract* (add a guard), never the worker.
