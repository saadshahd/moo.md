With `statechart`, Claude models a flow that moves between states, checks the rules its reader agrees to with everystate over every order of events, and charts it in the reader's words with the shortest path to each rule that breaks.

The bet: checking every order of events finds bugs that tests and a flow's own graph checks miss. First target: hum's kind machines (`hum-engine/defaults/kinds/*.json`, run as xstate machines), whose own checks cover only reachability and dead ends (`hum-engine/src/config/checks.ts`).

Graduate when 2 bugs it finds, in at least 2 flows, replay against the real code and get fixed. A finding counts only on a model a planted break was seen to fail. Kill if 3 flows modelled in earnest yield no bug that replays, or its findings keep turning out to be modelling errors.

## Field notes

### 2026-11-18 — founding, from cursor's pstack `statechart`

- Kept: rules the reader agrees to, as invariants never weakened; named actions; a do-nothing step for correct end states; small constants; labels in the reader's words, conditions in brackets; about 20 arrows; hiding that keeps the chart's claims; one line per bug with its numbered path; replay before believing a path.
- Kept as checks in `scripts/`, each tested: a spec SANY cannot read or a config TLC refuses stops the run; each invariant reruns without the ones that broke, and deadlock and each property run alone, so every rule gets a verdict; the shortest path per broken rule; a PROPERTY with no `[]`, `<>` or `~>` flagged as checking only the start states, read from SANY's levels; a label that is empty or leaks undefined or NaN refused; a hidden step on a bug's path or out of its loop refused; an arrow out of a bug's loop that the loop cannot take refused; above 500 states only the bug paths drawn, and with none no chart; a label over states that only some of which break a rule marked may-break, and one over states that break different rules refused.
- Changed: our own code, dependency-free, written from what pstack's skill says its command does. pstack's scripts were read, never run. TLC comes from `tla2tools.jar` and a Java the user installs; pstack installs both with mise. Every state a rule breaks comes from `-continue` runs, one per broken rule since TLC names only the first rule a state breaks, on a model small enough to chart.
- Dropped: parallel regions and parent states, so `state()` returns text only, and the region check with them: hum's machines are flat. Group colours and SVG rendering: the chart is Mermaid text, which a Pad or a pull request draws.
- Base rate: 57 of 2,536 local sessions have a prompt that names a state machine, a race, xstate, TLA+ or model checking. How many needed every order of events checked is not counted.

### 2026-11-18 — target, tool and upkeep, from cursor's pstack `create-formal-verification-skill` and `maintain-formal-verification-skill`

- Kept: the target is the promise whose break harms users most and tests rarely reach, never the easiest to model. The question picks the kind of tool: order to a model checker, every input to a verifier on the code, every size to a proof; `sound:find` picks the concrete tool.
- Kept: each action points at code a reviewer can open, and an indivisible step in the code stays one action. A planted break in the real code must be caught before a pass counts.
- Kept: the covered files and a sync commit, and the upkeep pass that sorts each change since the sync and ends in sync, updated, bug or blocked. They live in the spec's own header.
- Dropped: generating a verify skill in each repo. The owner ruled out generated per-repo skills; the spec's header holds what such a skill would record.

### 2026-11-18 — first run, on hum's five kind machines

- How: one generator, kept outside the repo, wrote a model per kind from its JSON and the engine code that drives it, each action citing its file and line. Left out: pauses, crashes, claims and a second worker; the token cap counts runs, not tokens.
- Planted breaks, both caught: fixing without its `token-cap` arrow broke "a run's question reaches the owner" in 5 steps; merging with no way out broke deadlock and "every item settles". Checking the fix cap before every fix run made the fix-cap rule hold. The plants went into the generator for the fix kind, not into hum's code, so the rules that held rest on model-level plants only.
- Finding, replayed: the fix cap is checked only when a fix step starts (`thin-path.ts:573`). A fix run whose question hum answers itself runs again inside the same step, and each run counts. With `maxFixRuns` 1, hum's own test world ran 3 fix runs, then ended stuck saying "after 1 fixes". Only the token cap bounds the loop. Whether the loop should recheck the cap is for hum's owner to decide.
- Mismatch, read, not run: in feature, fix and check, `tokenCap.overCap` says `asking`, yet a plan or review run past the cap ends stuck, as the comment on `runAgent` says it should. Only the config check reads `overCap`. Docs and hotfix have no plan or review state, so the rule holds there.
- Held on all five: a run's question reaches an owner wait; no deadlock; every item settles. Settling assumes a landing ends, which the code does not promise: a held landing retries without bound.
- The chart refused the first view, whose labels put states that break different rules under one name; the relabelled view drew 37 to 63 arrows against a budget of 20.
- The run showed the chart naming only the first rule a state breaks; 0.28.1 runs TLC once per broken rule to mark them all.
- Open for the skill: it says nothing about generating the model when the flow is already data, as hum's kinds are.

### 2026-11-18 — everystate in place of Java TLC

- Changed: the script runs everystate 0.4.0 through `bunx`. It is a Rust model checker that prints TLC's output, exit codes and state graph, so the command needs only bun: no Java, no `tla2tools.jar`.
- Closed, two gaps that changed verdicts with no error. everystate ignores `-continue`, so one run of a generated module now prints every state each broken invariant fails, in place of one `-continue` run per rule. Its SANY export writes a definition's name before its level, so levels are read in either order, and a PROPERTY with no level stops the run.
- Parity on hum's 20 kind specs, against the old script on Java TLC: 19 charts match, and the 20th refuses under both for the same merged label. Reports match apart from the engine's name, except in 4 plant-merging specs, whose `Settles` counterexample is shorter: 3 to 5 steps where TLC printed 7 to 10. Both are valid paths.
- Count keeps its known answer: Small breaks at n = 1, 2, 3 and Tiny at n = 2, 3.
- Under a CONSTRAINT, both checkers test each rule on the states just past it, which the graph leaves out. The chart leaves them out too, and the report counts, per rule, those that break it.
- Open: a rule that breaks only past the constraint stops the run, as it did under TLC.
- Closed 2026-11-18 in 0.29.1: under a CONSTRAINT or ACTION_CONSTRAINT, the chart adds each broken rule's path, so a path that ends past the bound ends on a drawn state, which the report marks as past the constraint. The report counts only the states past the bound that the chart still leaves out.
- Closed 2026-11-19: the report and chart mark each path step a CONSTRAINT or ACTION_CONSTRAINT cuts, above `--chart-states` too. everystate conform decides: it replays each drawn path on the bounded model, and again with every constraint off. Under a bound, the chart no longer draws a second arrow for an allowed path step whose action the trace names with its parameters.
- Closed 2026-11-27 in 0.29.3: a config with an ALIAS charts as the same config without it, bounded or not; before, none charted. An ALIAS changes only how a run prints a trace's states, so the script leaves it out of every config it hands everystate.
