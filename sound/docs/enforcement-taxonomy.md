# sound — enforcement taxonomy (all 102 corpus rules)

> Keystone for map **sound: enforcement-split + lazy-load the judgeable core** (#144), ticket #145.
> Partitions every `sound/corpus/*.md` rule into three enforcement classes, keyed off each rule's `Detect:` line.
> Downstream consumers: digest-membership, `/sound:review` design, lint-layer design, lazy-delivery.

> **2026-07-18 amendment (grugbrain gap analysis):** two rules added. `optimization-cites-a-measurement` → judgeable-at-write (uncited perf machinery is visible in resulting code). `removal-names-the-fences-reason` → process/commit-shape (the removed fence is invisible in the end state; its `Detect:` is diff-scoped, like characterize-before-refactor). Counts updated in place: 104 → 106.

> **2026-07-18 cutover (#167 — corpus-evolution release):** 4 merges, 1 split, 2 regates, 1 gap-fill rule. Judgeable −4 (76 → 72): merge-away `speculative-generality-guard`+`seam-earns-existence-at-second-adapter`+`deletion-test-before-any-abstraction-ships` → **`abstraction-earns-existence`** (−2); merge-away `chained-transformations-over-imperative-accumulation` → `single-expression-construction` (−1); merge-away `two-effect-blocker-names-the-smell-not-just-the-count` → `effect-is-a-named-intent` (−1); **`concept-count-not-line-count` regated judgeable → process** (−1 judgeable / +1 process); add gap-fill **`independent-awaits-run-together`** (+1, admitted by #169 propensity measurement). Process net 0: `tests-are-the-first-caller` merged into `red-green-refactor-is-a-commit-shape` (−1) balances the concept-count regate (+1). Deterministic unchanged (`invariant-boundary-constructor` split its recheck-duplication WRONG out to `duplication-taxonomy-triage` but keeps its class). **Property-testing cluster (6: `roundtrip-encode-decode-is-a-law`, `idempotence-of-repeatable-operations`, `invariant-preservation-over-mutation`, `generators-are-domain-documentation`, `shrinking-must-survive-to-the-failure-message`, `model-based-against-a-reference-implementation`) marked evidence-gated** — delivered only where a property runner is present, wired at `sound:setup` Select by #155 (class is unchanged; this is a delivery gate). `near-identical-examples-signal-an-unextracted-property` stays ungated (gateway). Counts updated in place: 106 → **102**.

## Key finding — the existing `check:` field is a two-class conflation

Every rule already carries a `check:` field on its meta line, but it has only **two** values: `deterministic` (31) and `judgeable` (73). That field conflates *"a machine can decide compliance"* with *"a machine can decide it **from a single edit's resulting code**."* The three-class split's real work is exactly what that conflation hides:

1. **Carve out process/commit-shape (5 rules).** These `Detect:` on a *git diff / commit / history*, not on resulting code — so they can never be a per-edit lint **or** a digest law; they belong to `/sound:review`. Two of the five were mislabeled `check:deterministic` **precisely because** they are mechanically checkable — but on a *commit*, not an *edit*.
2. **Re-examine the `check:deterministic` concurrency/aliasing/staleness rules.** Their `Detect:` gives a mechanical *proxy* (module-scope-mutable, ambient-read-in-fold, write/read-split-by-await) that over-fires without a concurrency/aliasing judgment the rule actually turns on. Reasoned reclassification → judgeable-primary, flagged for the lint-prototype ticket to confirm.

Because `check:` is model-authored and unverified, **treat every against-seed call below as a hypothesis to check against the eval set / a linter prototype, not a settled fact** (per `correctness-is-a-measured-rate`; two eval runs already disagree on borderline rules).

## Counts

| Class | Count | Downstream home |
|---|---|---|
| **deterministic** (per-edit) | 24 | lint layer — **leaves** the digest |
| **judgeable-at-write** | 72 | the **only** class that feeds #65's digest + pull-on-demand bodies |
| **process / commit-shape** | 6 | `/sound:review` |
| total | **102** | |

Against the `check:` seed: **+2** rules moved deterministic→process (red-green, tidy), **+3** judgeable→process (characterize, scratch-refactor, tests-are-first-caller), **+6** deterministic→judgeable (the concurrency/aliasing cluster + model-based), **+1** judgeable→deterministic (keys-are-identity). Net: seed-det 31→24, seed-judge 73→75, new process 5. *(That was the #145 reconciliation of the then-104 rules; the 2026-07-18 additions bring the table above to 76/6.)*

---

## Class 1 — deterministic (24) → lint layer, leaves the digest

Clean (linter/AST/grep decides compliance with negligible taste residual):

- dependency-at-the-edges
- exhaustiveness-is-a-compile-error-not-a-runtime-throw
- external-call-timeout
- invariant-boundary-constructor
- lookup-table-over-conditional-chain
- minimize-the-namespace-when-in-doubt-leave-it-out
- mood-names-commands-facts
- no-behavioral-boolean-props
- no-role-named-modules
- object-parameter-at-three-params
- predicate-names-ask-a-question
- role-suffix-lives-in-the-holder
- roundtrip-encode-decode-is-a-law
- set-prefix-means-caller-supplied-write
- shrinking-must-survive-to-the-failure-message
- small-aggregate-reference-by-id
- static-domain-tables-use-as-const-satisfies
- value-object-for-domain-primitive

Deterministic-primary but bordered (linter surfaces candidates reliably; taste only filters — see Border set):

- accountants-dont-use-erasers
- branded-primitives-for-domain-ids
- external-contract-not-internal-schema
- idempotence-of-repeatable-operations
- invariant-preservation-over-mutation
- keys-are-identity-not-position  *(moved from seed `judgeable`)*

## Class 2 — judgeable-at-write (72) → the digest + pull-on-demand bodies

- absence-as-terse-check
- abstraction-earns-existence  *(merge of speculative-generality-guard + seam-earns-existence-at-second-adapter + deletion-test-before-any-abstraction-ships, #167)*
- actor-isolation-only-for-independent-lifecycle
- as-cast-requires-a-named-justification
- atomicity-three-regimes
- base-spread-composition
- bounded-context-owns-its-type
- bulkhead-resource-partitioning
- caller-blind-function-names
- colocate-then-lift-on-second-consumer
- command-vs-fact-when-reconciled-elsewhere
- comment-must-name-a-consequence
- complecting-shared-construct-split-by-reason-to-change
- cross-boundary-data-is-an-immutable-past-snapshot
- cross-boundary-facts-are-queryable
- data-as-spec-earns-its-trigger
- data-clump-to-parameter-object
- derive-dont-sync
- derived-store-is-a-rebuildable-projection
- discriminated-union-over-flag-bag
- draft-entity-gets-its-own-noun
- duplication-taxonomy-triage
- effect-is-a-named-intent
- eliminate-mask-then-surface
- entity-is-the-atomic-boundary
- error-handling-two-regimes
- explicit-data-flow-at-the-call-site
- fail-fast-over-fail-slow
- feature-envy-misplacement
- generators-are-domain-documentation
- generics-only-for-a-real-relationship-between-inputs-and-output
- idempotent-handler-by-dedup-key
- illegal-input-unrepresentable-not-validated
- independent-awaits-run-together  *(gap-fill, admitted #169, added #167)*
- integration-point-isolation
- interface-is-the-full-contract
- lazy-over-eager
- model-based-against-a-reference-implementation  *(moved from seed `deterministic`)*
- module-is-the-noun-functions-are-bare-verbs
- named-predicate-over-inline-conditions
- near-identical-examples-signal-an-unextracted-property
- no-mutable-shared-return  *(moved from seed `deterministic`)*
- no-shared-mutable-state-across-workers  *(moved from seed `deterministic`)*
- one-behavior-per-test
- optimization-cites-a-measurement  *(added 2026-07-18)*
- order-by-logical-sequence-not-wallclock
- parse-dont-validate-at-every-untyped-boundary
- per-unit-crash-isolation  *(moved from seed `deterministic`)*
- place-code-where-it-would-be-found
- place-not-value-for-shared-mutable-state  *(moved from seed `deterministic`)*
- policy-vs-mechanism-split
- pure-decide-emits-facts
- pure-updates-isolated-io
- push-work-to-the-database
- remote-call-has-a-third-outcome
- replicated-state-is-a-deterministic-fold  *(moved from seed `deterministic`)*
- restart-policy-as-data
- rules-as-data-over-scattered-conditionals
- safety-invariant-is-an-executable-predicate
- seam-is-not-a-v2-interface
- sequential-dependency-encoded-in-return-type
- serialized-data-outlives-its-writer
- shortest-unambiguous-name
- side-effects-visible-at-the-call-site
- single-expression-construction
- sprout-over-inline-growth
- stale-message-is-dropped-by-version
- state-modeling-escalation
- steady-state-not-growth-state
- surface-write-conflict-never-silently-lww
- test-observable-behavior-not-structure
- ubiquitous-language-one-term-one-concept

## Class 3 — process / commit-shape (6) → `/sound:review`

Each `Detect:`s over a diff/commit/history — invisible in any single edit's resulting code:

- **characterize-before-refactor** — "a diff that changes control flow … where the new/only test was added in the same diff and asserts a value that differs from what the old code produced." Pure diff+sequence; not visible in end state. *(seed judgeable)*
- **red-green-refactor-is-a-commit-shape** — "git diff stat per commit — does a behavior-changing commit touch a `*.ts` without touching its paired test." Commit-scoped. *(seed deterministic — mechanically checkable, but on a commit)*
- **removal-names-the-fences-reason** — "a diff removing or short-circuiting a delay, retry, guard, or special case where neither the diff, its comments, nor its description says what the removed code was protecting against." Diff-scoped by construction — the fence is gone from the end state. *(added 2026-07-18)*
- **scratch-refactor-for-understanding** — "a shipped diff whose touched-file/line count is far larger than the stated bug/feature requires." Churn metric over a diff. *(seed judgeable)*
- **concept-count-not-line-count** — a diff that claims "simplified"/"inlined" while the number of concepts a reader must hold is unchanged; the check reads a PR's simplification claim against the actual concept delta, not any single edit's end state. Diff-scoped. *(regated judgeable → process at #167)*
- **tidy-or-behavior-never-both** — "per-commit diff — do the touched lines include both a rename/move and a line whose logic differs." Commit-scoped. *(seed deterministic — mechanically checkable, but on a commit)*

---

## Border set — the call, and why

Rules where a linter catches the easy case and taste catches the rest. Primary class is where each lands above; the note is the residual.

**Deterministic-primary** (linter surfaces candidates reliably; taste only filters):

| Rule | Linter catches | Taste residual |
|---|---|---|
| accountants-dont-use-erasers | destructive op (DELETE/UPDATE/`=`-assign) on a table matching `ledger\|journal\|audit\|entries\|events\|postings` | is this name truly a record of immutable facts |
| branded-primitives-for-domain-ids | 2+ same-primitive siblings whose positions could swap and still type-check | are they *domain ids* worth a brand |
| external-contract-not-internal-schema | handler serializing a persistence type w/ no mapping; message type lacking a version discriminant | is the serialized type genuinely "internal" |
| idempotence-of-repeatable-operations | grep test file for `f(f(` / an idempotence-named test | does the function name promise repeatability |
| invariant-preservation-over-mutation | grep `[db]` tests: only `toEqual`-vs-literal, no property assertion | which relational/structural invariant must hold |
| invariant-boundary-constructor | `new PascalCase(` outside owning module; 3+ positional fields | is the value "aggregate-shaped" |
| keys-are-identity-not-position | `react/no-array-index-key` covers index/regenerated keys | which stable field *is* the identity |

**Judgeable-primary** (the mechanical signal is a proxy that over-/under-fires; the real check is the judgment):

| Rule | Mechanical proxy | Why the judgment is the rule |
|---|---|---|
| no-mutable-shared-return | "Readonly all reference-typed returns" | over-fires on every non-aliasing return; the rule is *does it alias internal state* (escape analysis) |
| no-shared-mutable-state-across-workers | module-scope mutable read/written in a handler | needs *runs concurrently for different jobs* — not statically decidable |
| per-unit-crash-isolation | loop-over-array-with-`await`-no-`try` | needs *independent units of work* + isolation semantics |
| place-not-value-for-shared-mutable-state | write/read separated by `await`/handler/file | staleness across the gap is a dataflow judgment |
| replicated-state-is-a-deterministic-fold | `Date.now()`/`Math.random()`/ambient read inside a fold | gates on *this fold rebuilds replicated state* |
| model-based-against-a-reference-implementation | no sibling `model`/`oracle` file next to a stateful class | the *prescription* (this class NEEDS a model-based test) is heavy taste; **evidence-gated** (map Fog) |
| sprout-over-inline-growth | "a diff that adds inline logic to an untested function" | diff-framed, but extract-or-inline reads off resulting code |
| complecting-shared-construct-split-by-reason-to-change | last-N-commits cluster into two unrelated stories on one shape | commit-history is corroboration; the complected shape is visible at edit-time |
| single-expression-construction | empty-array-then-`.push`-loop (a `prefer-map`-style AST hit) | whether the loop's side-effects/early-exits *permit* a chain is the taste |

## Notes for downstream tickets

- **Fog cross-ref (map #144).** The property-testing cluster (`generators-are-domain-documentation`, `near-identical-examples…`, `model-based…`, `roundtrip-encode-decode-is-a-law`, `shrinking-must-survive…`, `invariant-preservation-over-mutation`) and the architecture-choice rules (`data-as-spec-earns-its-trigger`, `state-modeling-escalation`, `policy-vs-mechanism-split`) all land judgeable/deterministic here — but the Fog's *evidence-gating* question (do they gate on per-project evidence in Phase 2 Select?) is orthogonal to enforcement class and still open. Class does not decide digest-membership on its own; evidence-gating narrows the judgeable set further.
- **Two "mechanically-checkable-on-a-commit" rules** (red-green, tidy) prove the seed's conflation. If `/sound:review` is a commit-time check, it can be *deterministic there* — "process" is a delivery locus, not an admission that judgment is required.
- **Verification owed** (`correctness-is-a-measured-rate`): the 10 against-seed reclassifications are hypotheses. The lint-layer ticket should prototype the linter and measure false-fire rate on the eval set before trusting any border call as deterministic.
