---
paths: "**/*.{ts,tsx}"
when: always
source: grug + Knuth
topic: abstraction
---
when: [always] · tier: standard · check: judgeable
Complexity added in performance's name must cite the measurement that motivated it — a profile, a benchmark, a production trace — in a comment or the surrounding diff. Uncited perf machinery is speculative generality on the performance axis: the machinery has arrived before its trigger fired.
_Avoid_: a cache, memo table, precomputation pass, or hand-tuned rewrite of a clear transformation justified by "should be faster", "could get slow", or nothing.
Detect: perf machinery — memoization, a denormalized copy, an object pool, a single-pass loop replacing a named transformation chain — with no comment or diff prose naming the measured baseline it answers.
Not-when: the faster form costs no extra concepts (lazy-over-eager, push-work-to-the-database — structural moves that need no license); or the code sits under a stated budget (a frame loop, a documented SLO) — the budget is the measurement.
Cross-ref: abstraction-earns-existence — the same defect on the abstraction axis: there the named trigger is a second consumer, here it is a measurement. comment-must-name-a-consequence — the natural home of the citation. steady-state-not-growth-state — any cache the measurement does license still needs a bound.
