# sound:review measured rates

The `runs/` dir is gitignored (per-run artifacts are not committed), so the rates of record live
here. Re-derive any time with `./run.sh` then `bun score.mjs runs/<stamp>`.

> **STALE — corpus rewritten since this run.** The run of record below measured the pre-2026-07-21
> corpus (rules carried WRONG/RIGHT code examples and a metadata line). Every rule body has since
> been trimmed to pure instruction, so these rates describe a different artifact; re-run before
> trusting them for the current corpus (CLAUDE.md "Model-Judgment Boundaries").

## Run of record — 2026-07-20, sonnet, N=3 (84 runs, 0 excluded)

| Metric | Rate | Trust |
|---|---|---|
| **Recall** — caught the planted rule | **87%** (47/54) | trustworthy |
| **Wrong-flag** — fired, but on the wrong rule | 7/54 | trustworthy |
| **Not-when respect** — didn't cite the forbidden look-alike | **90%** (27/30 by pattern-specific anchor) | trustworthy |
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

**Specificity took three refinements to measure honestly:**

1. **Strict silence (7%) is invalid.** It counts *any* finding on a hard negative as a false alarm.
   But the ported hard-negatives are real agent code with many violations — "clean" only w.r.t. one
   narrow look-alike pattern. A whole-corpus review correctly surfaces the file's *other* real
   issues, so it is almost never silent. Verified by reading the findings (HN1/HN5/HN8): review
   flags different real rules, never the forbidden look-alike.

2. **Not-when respect (90%) is the honest metric** — did review avoid citing the *specific*
   forbidden look-alike (the Not-when the case is a negative for). **9 of 10 hard-negatives: 0/3
   over-fire (perfect).** The lone failure is **HN3**: review reliably (3/3) tells the two focused
   `useEffect`s in `useTimelineKeyboard` to merge into one — an unwanted suggestion (the effects
   carry distinct deps `[onStep]`/`[onEscape]`; merging couples two independent concerns). That is
   the one actionable specificity gap, not a blur across the set.

3. **Rule-name anchors over-count; pattern anchors fix it both ways (#172).** The earlier ≥87%
   (26/30) was luck-of-cancellation. A rule *name* matches whenever review cites that rule for a
   **different** instance: HN7 scored a false 3/3 "over-fire" (its old anchor was the name
   `duplication-taxonomy-triage`, which fired on a real within-file dup — `target.blocked && !altHeld`
   across two components — not the imported `DropTarget` the case is a negative for), while HN3's
   empty list gave a free 3/3 "respected." **Pattern-specific anchors** (the look-alike's own token,
   in each `label.json`'s `forbidden_anchor`) flip both: HN7 → 3/3 respected, HN3 → 0/3. Net precise
   rate **27/30 = 90%**. Anchors come in two kinds — **code tokens** where the look-alike IS an
   entity (`DropTarget`, `throw new Error`), **reason tokens** where the entity is legitimately
   flaggable by *other* rules so only the Not-when's concern counts (AXIS_GEOMETRY's `as const`
   typing nit, `dragAndDrop`'s duplication, and a desync bug citing `state-modeling-escalation`
   *inside* the justified machine are all correctly RESPECTED). Human is labeler of record for each
   anchor; `score.mjs` scores `respected` against `forbidden_anchor`, falling back to
   `forbidden_rules` only when a case carries no anchor.

## Refinement log

- **#171** — recall measured (87%, trustworthy); specificity fenced (rule-name proxy, ≥87% directional).
- **#172 (done)** — pattern-specific forbidden anchors labelled per hard negative; `score.mjs` scores
  `respected` against `forbidden_anchor`; precise specificity **90% (27/30)**, with HN3 the lone
  reliable over-fire. `sound:review` now ships **measured on both recall and specificity** — no
  residual fence.
