With `soloflow` as the way concurrent work starts, a goal fans out into lanes that each carry one contract — stop and ask when the work leaves your scope — and the human is asked nothing before spawn. The bet is that the contract only holds if it arrives at spawn, so a lane briefed this way stops at the edge of its scope where a hand-spawned lane runs past it silently and surfaces the mess at merge.

Graduate when, across ≥5 real runs of ≥2 lanes each — real meaning work that would have been done anyway, not staged to be measured: no worse than 1 in 3 lanes produce work thrown away or redone; and no single run costs more than 5 of the human's turns, counting answering lanes that stop and closing each lane by hand. Kill if either fires. Kill also if a running lane accepts the contract handed to it mid-flight — then typing the contract by hand is as good as this skill and there is nothing here to keep.

**Per run, not averaged.** A run costing 17 turns is the pull model failing on cost even if four other runs cost one turn each; a mean would hide exactly that.

**Burn — context, session and weekly off the pane footer — is recorded with no threshold, deliberately.** It is there to be looked at, not passed.

## Watched, not scored

No number attaches to these. Written down so a failure is recognised rather than explained.

- **The fog stop.** A lane that guesses where it should have stopped instead of stopping. No mechanical proxy exists and none is coming — for the reason under *the risk this sits on*, the behaviour has never been permitted to occur, so there is nothing to score a proxy against.
- **Scope enforcement**, which the fog stop now carries alone. Scope growth was measured in 43% of runs that could have been split. Unlike the fog stop its failures land in the diff, so they are at least visible afterwards.

## The risk this sits on

Every lane stopping is the product, and it has no precedent. **In 110 spawned lanes across six weeks, exactly one ever stopped to ask — and that one was a probe.** Every real fan-out on record was briefed *"Autonomous — do not ask questions."* The behaviour this skill is built on has never been permitted to occur, so nothing in the record supports it or refutes it. If this feels wrong in use, start here rather than with the mechanism.

## Field notes

### 2026-08-04 — founding, and the thresholds are set before any run

Born from a 22-ticket design effort that ran the pull model down to almost nothing. Its pre-ship gate read four numbers against a six-week corpus of 306 real episodes and **two of the four failed**, which is why what ships is one skill rather than the plugin, watcher, npm package and deterministic layer that were designed.

What the failures killed, so none of it is rebuilt by accident:

- **Acceptance cannot be written as a command up front.** E = 45.9% against a ≥80% floor, and only 16.2% of episodes had a command reading their whole diff. So nothing machine-closes a lane; `absent` as a lane state is dead and every lane is closed by hand, by looking. The two surviving states are *spinning* (working) and *static* (wants you **or** finished, indistinguishably).
- **Scope cannot be enumerated up front.** 42.9% of runs breached their split against a ≤33% threshold — and an oracle credited with every file the session ever touched scored the **identical** 42.9%, because the work lands in groups nobody identified at the start.

That second result is also why this skill asks the human nothing. The design had him rule on couplings; he rejected the vocabulary outright — *"the word seam has no meaning to me… why am I answering a seam or not?"* — and the oracle reading says the ruling was unanswerable by anyone, him or the agent or a perfect predictor. A gate no one can pass correctly is ritual. Removed 2026-08-04, along with the word.

**The founding claim is thinly evidenced and this is the first thing to disconfirm.** That a running lane refuses the contract and a spawn-briefed lane obeys was measured **once each, and on `confirm_self_close`** — a contract this design has since deleted. The stop-and-ask contract that ships has never been retrofit-tested. The check is cheap: hand one running lane the contract mid-flight and see.

### Readings

#### 2026-08-05 — run 1, four lanes planned, three spawned

The first real run, and it did not reach the thresholds — it failed before them, on a mechanism nothing in the design had a path for. Three `spawn_agent` calls succeeded; the fourth returned `Over free tier limit — upgrade or reduce projects/processes`. **Capacity is N−1 and the design assumed N** — the lead is itself a process counting against the same cap, so a four-lane plan needs five slots, and the arithmetic only fails at spawn, after the scratchpad is written with four lane sections.

The lead absorbed the unstaffed lane and worked it inline. It picked by *coupling* — the lane with zero file overlap — because coupling is what the skill trains the lead to think about. That criterion was the wrong one: least-coupled is not cheapest-in-context, and the absorbed lane put nine files across two packages into the arbiter's context exactly as three lanes were about to return `shared` appends for it to arbitrate. `Agent` was never weighed; the session prompt forbids it unprompted.

Three readings, none of them about the bet itself:

- **The lead had no stop-and-ask clause.** The lane contract has a good one; the orchestrator has none, so an unrecoverable environment constraint resolved in the lead's judgment and was announced after the decision rather than raised as a question.
- **Absorption is invisible where an unstaffed section is not.** A lane parked in a written-but-unstaffed scratchpad section can be staffed by anyone later. A lane folded into the lead can not be seen at all.
- **A pre-spawn capacity gate was written and then removed the same day.** The tier cap is not readable from `list_processes`, so the gate's cannot-tell branch fires on every run — `:31`'s ritual, rebuilt. The failure path after spawn carries it instead: report, never absorb.

**Nothing here reads on the founding claim.** No lane stopped to ask, because the run never got far enough for one to; the retrofit test at `:33` is still uncosted and still the first thing to do.
