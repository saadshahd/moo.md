# Loop selection

Read this when the work iterates — an agent loop, a refinement cycle, an unbabysat run. "Which loop" is a HOW dimension; resolve it on three axes. The decided path carries the chosen loop and its termination rule.

| Axis | Question | Reliability rule |
| --- | --- | --- |
| Verifier locus | Does "better" come from outside the model — tests, tool result, metric, separate judge — or only the model itself? | No external signal → never loop on a correctness task; it degrades. Take best-of-N first attempts instead. With one, each cycle makes one change and measures it on the real artifact: keep it if the signal moved, revert it if not. |
| Plan mutability | Plan fixed once, or revised as reality diverges? | Cap the turns and files read per phase; a revised plan without that cap never converges. |
| Termination | Budget cap, signal-gated, fixed-round, or judgment-delegated? | Judgment-delegated (an LLM decides "done") is the silent non-convergence source — always back it with a hard cap. |
