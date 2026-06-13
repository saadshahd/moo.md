# Cheat Museum — known specification-gaming patterns

The ways a literal optimizer satisfies a target without doing the work, each paired with the fence that closes it. The red-team (target work loop, step 3) runs this catalog before hunting task-specific cheats — proven over invented. Extended by deliberate edit when a new archetype appears, never auto-appended during a run.

Adapted from the loss-function-development project (elvisun).

## 1. Seed-data mirroring
**Cheat:** the run generates seed or fixture data that mirrors the eval set, then "finds" it.
**Fence:** blind evaluation during runs; reject overlapping seed data; score on a withheld holdout.

## 2. Miss-list mining
**Cheat:** per-item feedback leaks answers incrementally, letting the run build a keyword lookup matching eval items.
**Fence:** audit leakage rate; cap miss lists; expand eval scope; capacity-limit artifacts that store keywords.

## 3. Brute enumeration
**Cheat:** the run grows a precise-lure list one term at a time, hundreds deep, without per-item feedback.
**Fence:** hard capacity caps on list artifacts; lint for eval-matching literals; probe-gap detection.

## 4. Scorer editing
**Cheat:** the run "fixes" the scoring script, the threshold, or the eval loader.
**Fence:** mark harness and eval dirs read-only; checksum scorers; score the holdout outside the run's access.

## 5. Judge gaming
**Cheat:** an LLM judge approves outputs matching surface patterns rather than real quality.
**Fence:** prefer mechanical measurement; calibrate judges on known pairs; halt if judges fail separation.

## 6. One-sided metric
**Cheat:** optimizing a single metric (recall-only, precision-only, latency-only) yields a trivial solution.
**Fence:** every metric penalizes failure in both directions; adversarially review metrics before launch.

## 7. Dev-set victory lap
**Cheat:** the run hits the bar on dev and declares done; the holdout was never checked.
**Fence:** define acceptance exclusively on the holdout; state this in the stop condition.

## 8. Eval peeking
**Cheat:** answers sit in a readable file; the run "happens" to read it while exploring the repo.
**Fence:** place the holdout outside the working directory; embed canary strings in eval files; lint for eval reads.

## 9. Special-case branching
**Cheat:** pattern-matching code like `if query == "...":` acts as a hidden lookup table.
**Fence:** extend capacity caps to branches; probe-gap test on perturbed inputs.

## 10. Clock and budget amnesia
**Cheat:** the run keeps optimizing past exhausted resources or diminishing returns.
**Fence:** expose wall-clock and spend as first-class signals; enforce budget and diminishing-returns stops.

## 11. Same-knob descent
**Cheat:** the run finds one knob worth +0.1% and turns it forever; every other direction goes unexplored.
**Fence:** stall rules requiring structural change; exploration quota every K cycles.

## 12. Oracle-mining the enforcement instrument
**Cheat:** violation reports from a constraint checker leak eval membership when the run probes candidate strings.
**Fence:** run eval-touching checks inside the scorer only; void the score on violation; keep detailed lint output out of the run's reach.

## 13. Transcript narration
**Cheat:** the run claims the check passed in prose; a transcript-only evaluator reads the words, not the command output, and approves.
**Fence:** the condition requires the verify command's real output — exit code, score line — in the transcript; the evaluator looks for that artifact, not the claim.
