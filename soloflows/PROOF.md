# PROOF

What would kill `soloflows`, written down before the first run so that a bad result cannot be
reinterpreted into a good one afterwards.

**Readings below are `soloflows`' own runs only.** No predecessor measurement is ever recorded as a
result here — hunch's record is hunch's, and lives in `hunch/GRADUATED.md`.

Thresholds are a different matter and do cite prior measurement, because that is what set them.
A number with no derivation is arbitrary, and one derived after the fact is not a threshold at all.

## Scale

**5 real runs, at least 2 lanes each.** Real means work that would have been done anyway, not a
run staged to be measured.

## The numbers

| | what is counted | threshold |
| --- | --- | --- |
| 1 | of the lanes a run produced, how many produced work that was **kept** | kill at worse than **1 in 3** thrown away or redone |
| 2a | burn — context, session and weekly, off the pane footer | **no threshold, deliberately** |
| 2b | your turns across the whole run — answering lanes that stop, and closing each one | kill at more than **5 turns, per run** |

**Number 2b is per run, not averaged.** A run costing 17 turns is the pull model failing on cost
even if four other runs cost one turn each, and a mean would hide exactly that.

**2b was re-scoped, and this is recorded so it reads as a change rather than a convenience.** It
originally counted turns spent *getting the run split and spawned*, and 5 was a doubling of the 2
rulings a prototype approval surface measured. That surface has since been removed — the skill
decides the split and asks nothing — so those turns are now one: typing the command. Left as
written, 2b could not fail. The number **5 is unchanged**; what it counts moved to where the cost
actually landed, which is after spawn: answering lanes that stop, and closing every lane by hand.
Anyone auditing this should treat a re-scoped threshold with suspicion and check that the new
scope is where the work went.

**2a has no threshold on purpose.** It is recorded to be looked at, not to be passed.

## Watched, not read

No number attaches to these. They are written here so that a failure is recognised rather than
explained.

- **The fog stop.** A lane that guesses where it should have stopped. No mechanical proxy exists
  and none is coming: for the reason in the section below, the behaviour has never been permitted to
  occur, so there is nothing to score a proxy against.
- **Scope enforcement**, which the fog stop now carries alone. Scope growth was measured in **43% of
  runs that could have been split**. Unlike the fog stop, its failures land in the diff, so they are
  at least visible after the fact.
- **Whether the contract has to arrive at spawn at all.** The plugin's entire reason to exist is
  that a running lane refuses this contract later and an identical lane obeys it at spawn. That
  pair was measured **once each — and on a different contract**, `confirm_self_close`, which has
  since been deleted from the design. The stop-and-ask contract that actually ships has never been
  retrofit-tested. If a running lane accepts it, typing the contract by hand is as good as this
  plugin and the plugin should go. Cheapest possible check, and worth doing before the 5 runs:
  hand one running lane the contract mid-flight and see.

## The risk this whole design sits on

Every lane stopping is the product, and it has no precedent. **In 110 spawned lanes across six
weeks, exactly one ever stopped to ask — and that one was a probe.** Every real fan-out on record
was briefed *"Autonomous — do not ask questions."* The behaviour this plugin is built on has never
been permitted to occur, so nothing in the record supports it or refutes it.

If the shipped plugin feels wrong, start here rather than with the mechanism.

## Readings

_None yet — no run has happened._
