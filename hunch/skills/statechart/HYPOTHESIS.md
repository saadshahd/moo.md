With `statechart`, Claude models a flow that moves between states, checks the rules its reader agrees to in TLC over every order of events, and charts it in the reader's words with the shortest path to each rule that breaks.

The bet: checking every order of events finds bugs that tests and a flow's own graph checks miss. First target: hum's kind machines (`hum-engine/defaults/kinds/*.json`, run as xstate machines), whose own checks cover only reachability and dead ends (`hum-engine/src/config/checks.ts`).

Graduate when 2 bugs it finds, in at least 2 flows, replay against the real code and get fixed. Kill if 3 flows modelled in earnest yield no bug that replays, or its findings keep turning out to be modelling errors.

## Field notes

### 2026-11-18 — founding, from cursor's pstack `statechart`

- Kept: rules the reader agrees to, as invariants never weakened; named actions; a do-nothing step for correct end states; small constants; labels in the reader's words, conditions in brackets; about 20 arrows; hiding that keeps the chart's claims; one line per bug with its numbered path; replay before believing a path.
- Kept as checks in `scripts/`, each tested: a spec SANY cannot read or a config TLC refuses stops the run; each invariant reruns without the ones that broke, and deadlock and each property run alone, so every rule gets a verdict; the shortest path per broken rule; a PROPERTY with no `[]`, `<>` or `~>` flagged as checking only the start states, read from SANY's levels; a label that is empty or leaks undefined or NaN refused; a hidden step on a bug's path or out of its loop refused; an arrow out of a bug's loop that the loop cannot take refused; above 500 states only the bug paths drawn, and with none no chart; a label over states that only some of which break a rule marked may-break, and one over states that break different rules refused.
- Changed: our own code, dependency-free, written from what pstack's skill says its command does. pstack's scripts were read, never run. TLC comes from `tla2tools.jar` and a Java the user installs; pstack installs both with mise. Every state a rule breaks comes from one `-continue` run on a model small enough to chart.
- Dropped: parallel regions and parent states, so `state()` returns text only, and the region check with them: hum's machines are flat. Group colours and SVG rendering: the chart is Mermaid text, which a Pad or a pull request draws.
- Base rate: 57 of 2,536 local sessions have a prompt that names a state machine, a race, xstate, TLA+ or model checking. How many needed every order of events checked is not counted.
