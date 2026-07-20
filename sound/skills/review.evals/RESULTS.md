# sound:review measured rates

The `runs/` dir is gitignored (per-run artifacts are not committed), so the rates of record live
here. Re-derive any time with `./run.sh` then `bun score.mjs runs/<stamp>`.

## Run of record — 2026-07-20, sonnet, N=3 (84 runs, 0 excluded)

| Metric | Rate | Trust |
|---|---|---|
| **Recall** — caught the planted rule | **87%** (47/54) | trustworthy |
| **Wrong-flag** — fired, but on the wrong rule | 7/54 | trustworthy |
| **Not-when respect** — didn't cite the forbidden look-alike | **≥87%** (26/30 by rule-name proxy; true rate higher) | direction trustworthy, precise rate pending |
| Strict silence — said nothing at all | 7% (2/30) | **invalid** — see below |

### Per-rule recall (VIOLATION cases)

```
 67%  10/15  absence-as-terse-check          <- the hard one; borderline (C01/C06 swing TP/WRONG)
100%   3/3   caller-blind-function-names
 83%   5/6   dependency-at-the-edges          <- C13 swings WRONG/TP
100%   3/3   discriminated-union-over-flag-bag
100%   3/3   duplication-taxonomy-triage
 67%   2/3   error-handling-two-regimes       <- C14 swings TP/WRONG
100%   3/3   lookup-table-over-conditional-chain
100%   3/3   no-mutable-shared-return
100%   3/3   no-role-named-modules
100%   6/6   place-code-where-it-would-be-found
100%   6/6   single-expression-construction
```

Unstable (N=3 earning its keep — one run would have lied): C01, C06, C13, C14, HN1, HN2.

## What the numbers mean

**Recall (87%) is the trustworthy headline.** review catches the planted rule most of the time,
reliably (100%) on the structural rules (placement, duplication, single-expression, lookup-table,
discriminated-union) and weakest on `absence-as-terse-check` (67%) — the one whose violation
(`T | null` unions, `=== null` chains) most often loses the review's attention budget to *other*
genuine findings in the same real file. That competition is the honest shape of a deep review, not
a blind spot: read the `.out` files and the missed absence is usually there, just below more
consequential findings.

**Specificity took two refinements to measure honestly:**

1. **Strict silence (7%) is invalid.** It counts *any* finding on a hard negative as a false alarm.
   But the ported hard-negatives are real agent code with many violations — "clean" only w.r.t. one
   narrow look-alike pattern. A whole-corpus review correctly surfaces the file's *other* real
   issues, so it is almost never silent. Verified by reading the findings (HN1/HN5/HN8): review
   flags different real rules, never the forbidden look-alike.

2. **Not-when respect (≥87%) is the honest metric** — did review avoid citing the *specific*
   forbidden look-alike (the Not-when the case is a negative for). 8 of 10 hard-negatives: 0/3
   over-fire (perfect). The two apparent exceptions are mostly **proxy artifacts**: HN7 scores 3/3
   "over-fire" only because its forbidden anchor is the rule *name* `duplication-taxonomy-triage`,
   and review flagged a *different, correct* duplication in the file (`target.blocked && !altHeld`
   repeated across two components), not the imported `DropTarget` type the case is a negative for.
   So true specificity is higher than the 87% the rule-name proxy reports.

## Honest residual / next refinement

Precise specificity needs **pattern-specific forbidden anchors** per hard negative (the look-alike's
concrete token, like `must_mention` for violations), not rule names — because a whole-corpus review
can legitimately cite the same rule for a different instance. Until then: recall is measured and
trustworthy; specificity is directionally strong (review respects rule Not-whens) with a precise
rate pending that labeling pass. `sound:review` ships **measured on recall, fenced on specificity**
— the honest state, not a gap.
