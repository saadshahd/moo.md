# Loop selection

Read this when the work iterates — an agent loop, a refinement cycle, an unbabysat run. "Which loop" is a HOW dimension; resolve it on three axes. The decided path carries the chosen loop and its termination rule.

| Axis | Question | Reliability rule |
| --- | --- | --- |
| Verifier locus | Does "better" come from outside the model — tests, tool result, metric, separate judge — or only the model itself? | No external signal → never loop on a correctness task; it degrades. Take best-of-N first attempts instead. |
| Plan mutability | Plan fixed once, or revised as reality diverges? | A revised plan must carry a budget cap, or it never converges. |
| Termination | Budget cap, signal-gated, fixed-round, or judgment-delegated? | Judgment-delegated (an LLM decides "done") is the silent non-convergence source — always back it with a hard cap. |
