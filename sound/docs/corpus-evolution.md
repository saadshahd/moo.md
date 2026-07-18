# sound — corpus evolution release (gap analysis → decisions)

> Grilled and confirmed 2026-07-18. Inputs: full 106-rule read (4 readers) + 3 gap lenses
> (practice-space, agentic-failure-mode, best-not-most). Working artifacts: solo scratchpads
> `sound-corpus-inventory`, `sound-gap-map` (moo.md project).
> Gated behind the #164 verdict; lands before #155 so setup Phase-6 scaffolds the evolved corpus once.
>
> **APPLIED 2026-07-18 (#167 cutover).** Final: **106 → 102** (−5 subtractions via 4 merges, +1 addition
> `independent-awaits-run-together`). The addition slate collapsed 5 → 1 at #169 (propensity measurement:
> only awaits reproduced; interpolation/disposal/stdlib deferred → tier-3; test-weakening → #151). The
> "~98 survivors + 5" projection below is superseded by that collapse plus the 3 rejected subtractions (#166).
> **5 amendments** landed (the 4 below + the cross-boundary-facts × integration-point reconciliation from the
> #166 ruling — *adapter owns observability*). Merge-2 tier resolved by the human: the chained+single-expr
> merge is **standard** (absolutism softened), so opt-in 3 → 2. Ledgers reconciled: enforcement-taxonomy
> **24/72/6**, skill-partition **43 default (+2 opt-in)**, digest-membership **2 / 20 / 51**. Owed downstream:
> eval fixtures still name 4 merged/deleted rules (setup `expected.json` ×2, pull-through `expect.txt`,
> judge-calibration dir) — flagged in the #167 resolution, not fixed here (outside the decision-5 apply surface;
> the two setup fixtures are human-labeled).

## Decisions (settled, user-confirmed)

1. **Intention — in-flow steering only.** The corpus changes what the writing agent produces in a
   sound-equipped repo. A published canon is at most a rendering, never an admission argument.
2. **Target — my taste, publishable later.** User is labeler of record; no wording that only works
   in these repos; setup Select carries per-repo tuning. No rule admitted for a hypothetical consumer.
3. **Shape — honest enforcement class, delivery follows.** Diff-scoped rules are authored Class-3 and
   wait for `/sound:review` (#151). Nothing is contorted into at-write form to dodge a missing channel.
4. **Amend vs new — amendment-first.** A gap whose firing moment an existing rule owns becomes an
   amendment to that rule. New rules only for unowned moments.
5. **Subtractions — user adjudicates each action** in one sitting (the #165 pattern); accepted actions
   apply **atomically**: corpus + enforcement-taxonomy + skill-partition + digest docs in one cutover.
6. **Sequencing — after #164 verdict, before #155.** #164's delivery-mechanism finding stays valid on
   the current corpus.
7. **Length — admission bar, no cap.** Admission requires: (a) a mined fixture proving agents produce
   the violation, at admission (#162's lesson made law); (b) an honest enforcement class; (c) an owned
   moment no other rule owns — else amendment. Size is an output, never a target.
8. **Release scope — tier 1+2 additions + 4 amendments.** Tier-3 mediums park behind their own
   fixture evidence. Harness-shaped gaps feed #152, never become rules.

## Headline finding

The corpus is strong on structure-of-good-code and nearly silent on the most distinctly agentic
failure family: **silencing the observer** — under "make it pass" pressure a model mutes the test
(weaken/skip/refit), the failure (fabricated fallback values), or the type checker (`any` /
`@ts-ignore` / widening). Each reports success while destroying the signal that would have caught it.
`eliminate-mask-then-surface` step-2 is currently **citable by a model to license** silent fallbacks —
a rule-text hole, not just a coverage hole.

## The release

### New rules (5) — each owes a mined fixture at admission

| rule | claim (short) | class |
|---|---|---|
| test-weakening-to-green | a failing test is a spec: fix the code or declare the behavior change; never loosen/skip/refit to observed output | process (→ #151) |
| independent-awaits-run-together | await-in-loop over independent items = N+1 latency + unmodeled partial failure; the `when:always` sibling of per-unit-crash-isolation | judgeable |
| acquisition-pairs-with-disposal | listener/interval/subscription without visible release; superseded fetch without AbortController | judgeable |
| interpolation-is-not-composition | data-derived strings never reach exec/SQL/HTML sinks via interpolation; execFile/params/sanitizer | judgeable |
| stdlib-reimplementation | hand-rolling what stdlib or an installed dep owns is a defect; structured formats get their parser, never regex; crypto hand-rolls never | judgeable |

### Amendments (4)

- **eliminate-mask-then-surface** — add the discriminator: a masked value must be a domain-sanctioned
  meaning of the absent case (empty range → `[]` true), never a fabricated stand-in (fetch failed →
  `[]` lie); unimplemented paths are loudly unimplemented. Closes the self-licensing hole.
- **as-cast-requires-a-named-justification** — widen from `as` to all checker-silencing: `any`,
  `@ts-ignore`, optionality/union widening; `@ts-expect-error` demands the same named justification.
- **comment-must-name-a-consequence** — add the temporal category: comments narrating the change
  ("updated to fix X") rather than the code; change history belongs in the commit message.
- **test-observable-behavior-not-structure** — add owned-seam mocking (doubles only at seams you own,
  e.g. the integration-point adapter, never third-party internals) + the tautological-mock clause
  (a test whose every assertion derives from its own stubs verifies nothing). Also supplies the
  canonical violation face whose absence caused test-structure's 20% recall in #162.

### Subtraction slate — for the adjudication sitting (evidence quotes in `sound-gap-map` scratchpad)

- MERGE speculative-generality-guard + seam-earns-existence-at-second-adapter +
  deletion-test-before-any-abstraction-ships → one abstraction-earns-existence ladder
  (the delete-vs-date ladder is duplicated byte-identical in 4 files and IS the merged rule;
  colocate-then-lift stays separate — react-gated)
- MERGE chained-transformations + single-expression-construction (one detector; taxonomy already
  treats them as one lint row)
- MERGE two-effect-blocker → effect-is-a-named-intent (no standalone trigger)
- MERGE tests-are-the-first-caller → red-green-refactor (identical commit-pairing fingerprint)
- MERGE draft-entity-gets-its-own-noun → discriminated-union-over-flag-bag (self-declared type-level
  form; Detect is a strict special case; fixes its missing Not-when free)
- DELETE cross-boundary-facts-are-queryable (condemns the call-site shape integration-point-isolation
  prescribes; violation is an absence — the structurally-unjudgeable class; fold an adapter-logs
  clause into integration-point-isolation)
- DEMOTE interface-is-the-full-contract → types-skill preamble (counterfactual Detect; every concrete
  face already owned elsewhere)
- SPLIT invariant-boundary-constructor (second WRONG = recheck-duplication → duplication-taxonomy;
  restores honest deterministic label)
- REGATE property-testing cluster (6 rules) behind an evidence gate in setup Select (no property
  runner ⇒ un-runnable prescriptions); near-identical-examples stays ungated as gateway
- REGATE concept-count-not-line-count → process class (Detect observes a diff event)
- TRIM place-code third claim (verbatim dup of minimize-the-namespace); duplication-taxonomy tier
  clause (tiers never defined); seam-v2 vs atomicity `*V2` boundary line; fix tidy-or-behavior paths
  glob (test-glob gates a commit-scoped rule)
- KEEP (checked, rejected as excess): shared-mutable-state quartet, feature-envy/bounded-context,
  error-regime pair, restart-policy/fail-fast, idempotence pair

Net: 106 → ~98 survivors + 5 additions.

### Harness feed (→ #152, not rules)

floating promises (`no-floating-promises` type-aware lint; taste residue: `void` + why), secrets in
source (gitleaks/CI), dead code/unused imports (knip/fallow), console.log/TODO (lint), hallucinated
library APIs (structurally unjudgeable — judge shares the stale priors; tsc/tests/doc-fetch only).

### Parked (tier-3, each gated on its own fixture evidence)

error-carries-the-evidence · no-wall-clock-waits-in-tests · time-is-stored-utc-computed-by-calendar ·
diff-churn (→ #151 with test-weakening)
