# sound — topic partition of the judgeable core into `sound:<topic>` skills

> Resolves map **sound: enforcement-split + lazy-load the judgeable core** (#144), ticket **#165**.
> Feeds **#164** (measure this set's auto-invoke + pull-through) → **#155** (emit it from `sound:setup` Phase 6).
> Builds on `enforcement-taxonomy.md` (#145, the judgeable class), `digest-membership.md` (#149, surface-gating), `lazy-delivery.md` §Phase-6 (#163, the skill mechanism).

> **2026-07-18 amendment (grugbrain gap analysis + opt-in-gate reconciliation):** `optimization-cites-a-measurement` added to the judgeable class → enters this partition under **abstraction**. The scope derivation now also subtracts the 3 human-locked opt-in rules (#149/#153) that the original 47 silently delivered by default: **default-delivered = 45**, partitioned incl. opt-in = 48. Sibling `removal-names-the-fences-reason` is process/commit-shape → `/sound:review` (5 → 6), explicitly OUT here.

> **2026-07-18 cutover (#167):** merges/regates reshape the partition. abstraction 11 → **8** (−`speculative-generality-guard`/`seam-earns-existence-at-second-adapter`/`deletion-test-before-any-abstraction-ships`, merged → +`abstraction-earns-existence`; −`concept-count-not-line-count`, regated to process/`/sound:review`). effects 8 → **9** (+`independent-awaits-run-together`, admitted #169). control-flow opt-in retired — `chained-transformations-over-imperative-accumulation` merged into `single-expression-construction` (standard), so opt-in 3 → **2** (`module-is-the-noun-functions-are-bare-verbs`, `base-spread-composition`). react surface-gated 4 → 3 (`two-effect-blocker…` merged into `effect-is-a-named-intent`), so surface-gated 28 → **27**. Property cluster (`generators-are-domain-documentation` + `near-identical-examples…` in the tests skill; `model-based`/`roundtrip`/`shrinking`/`invariant-preservation` elsewhere) marked **evidence-gated** — the tests skill's property rows emit only where a property runner is present (wired at setup Select, #155; `near-identical-examples` stays ungated as the gateway). Net: **43 default-delivered** (45 incl. opt-in).

## Scope — the 45 delivered rules (+3 opt-in)

The topic-skills carry the **non-surface-gated judgeable-at-write** rules only:

- Start: Class-2 judgeable-at-write = **72** (`enforcement-taxonomy.md`).
- − **27 surface-gated** (react/db/distributed-tagged) → stay native `.claude/rules/` `paths`-rules.
- − **2 opt-in** (`corpus-optin/`, human-locked #149/#153) — partitioned below for when they're wanted, but emitted **only** when explicitly named at setup, never by default.
- The one `check:deterministic` core tenant (`branded-primitives-for-domain-ids`) is already in Class 1 → lint (#152), not here.
- **= 43 default-delivered** (45 partitioned incl. opt-in).

Explicitly OUT (do not fold into these skills): the 24 deterministic rules (→ lint #152), the 6 process/commit-shape rules (→ `/sound:review` #151 — this is where a `git`/`review` skill would live, *not* here), the 28 surface-gated rules (→ `paths`-rules).

## The 7 skills

| `sound:<topic>` | situation-keyed `description` trigger | # |
|---|---|---|
| **naming** | naming a value, type, function, or module, or writing a comment | 5 (+1 opt-in) |
| **types** | declaring a type or representing data — unions, absence, parsing untyped input, a function's contract | 9 |
| **effects** | mutating state, performing IO, or writing code that can fail — and its commit atomicity | 9 |
| **control-flow** | writing a loop, a compound conditional, or building a collection into shape | 4 |
| **abstraction** | extracting, generalizing, or deduplicating code — deciding whether an abstraction, seam, or optimization earns its place | 8 (+1 opt-in) |
| **placement** | deciding where code lives — module ownership, splitting by reason-to-change, policy vs mechanism, feature envy | 4 |
| **tests** | writing or structuring a test, or reaching for property/generator-based testing | 4 |

`structure` (15) was **split** into `abstraction` (11) + `placement` (4) — the human's call (#165), for sharper triggers at the two distinct refactor moments (should-this-exist vs where-does-it-belong). *(2026-07-18: `abstraction` stays 11 by default — `base-spread-composition` moved behind the opt-in gate, `optimization-cites-a-measurement` added; the #167 cutover then brought abstraction to **8**.)* Accepted cost: one extra artifact and two triggers that can both fire at refactor time.

## Rule → skill

```
naming:       caller-blind-function-names · shortest-unambiguous-name · ubiquitous-language-one-term-one-concept
              module-is-the-noun-functions-are-bare-verbs *(opt-in)* · draft-entity-gets-its-own-noun · comment-must-name-a-consequence
types:        absence-as-terse-check · as-cast-requires-a-named-justification · parse-dont-validate-at-every-untyped-boundary
              illegal-input-unrepresentable-not-validated · discriminated-union-over-flag-bag · state-modeling-escalation
              bounded-context-owns-its-type · command-vs-fact-when-reconciled-elsewhere · interface-is-the-full-contract
effects:      no-mutable-shared-return · pure-updates-isolated-io · side-effects-visible-at-the-call-site
              explicit-data-flow-at-the-call-site · actor-isolation-only-for-independent-lifecycle
              error-handling-two-regimes · eliminate-mask-then-surface · atomicity-three-regimes
              independent-awaits-run-together
control-flow: named-predicate-over-inline-conditions · rules-as-data-over-scattered-conditionals
              single-expression-construction · lazy-over-eager
abstraction:  abstraction-earns-existence · sprout-over-inline-growth · duplication-taxonomy-triage
              seam-is-not-a-v2-interface · generics-only-for-a-real-relationship-between-inputs-and-output
              data-clump-to-parameter-object · base-spread-composition *(opt-in)* · data-as-spec-earns-its-trigger
              optimization-cites-a-measurement
placement:    place-code-where-it-would-be-found · feature-envy-misplacement
              complecting-shared-construct-split-by-reason-to-change · policy-vs-mechanism-split
tests:        one-behavior-per-test · test-observable-behavior-not-structure
              generators-are-domain-documentation · near-identical-examples-signal-an-unextracted-property
```

## Boundary calls (defaulted — reversible in #164 scaffolding)

Each fires at two moments; the bucket is keyed to *which situation makes Claude reach for it*, not which principle it expresses. These were defaulted to the tentative pick (human did not override); #164 fixture-building surfaces any that mis-key.

| rule | pick | over | why |
|---|---|---|---|
| named-predicate-over-inline-conditions | control-flow | naming | fires when writing a 2+ clause `if`; the name quality is residual |
| rules-as-data-over-scattered-conditionals | control-flow | abstraction | trigger is "writing an if-chain for a policy" |
| data-as-spec-earns-its-trigger | abstraction | types | the moment is "should I build this interpreter at all" |
| command-vs-fact-when-reconciled-elsewhere | types | effects | the fix is a `pending\|confirmed\|rejected` union |
| interface-is-the-full-contract | types | placement | fix carries error modes + units into the signature |
| comment-must-name-a-consequence | naming | abstraction | the moment is writing a comment |
| draft-entity-gets-its-own-noun | naming | types | "gets its own *noun*" is a naming act |
| lazy-over-eager | control-flow | effects | moment is ordering a computation around a guard |
| base-spread-composition | abstraction | types | duplication rule (define core once); trigger is repeated literals |
| actor-isolation-only-for-independent-lifecycle | effects | types | concurrency/isolation lifecycle |
| optimization-cites-a-measurement | abstraction | effects | the moment is "does this perf machinery earn its place" — speculative-generality's sibling |

## Each skill's shape (for #155)

Per `lazy-delivery.md` §Phase-6: `.claude/skills/sound-<topic>/SKILL.md`, `user-invocable: true` + auto-invoke, `description` = the trigger above; body = the topic's situation-keyed sub-table (`<cue> → <rule>.md`), one skill-internal byte-preserved reference file per rule.

## Owed downstream

- **#164** scaffolds these 7 skills into fixtures and measures topic-set vs generic-1 vs baseline auto-invoke + body-Read. If a boundary rule mis-keys (skill never fires on its situation), reassign it there.
- **#164** also carries the `structure`-split's implicit test: if `abstraction`/`placement` triggers overlap so much they co-fire without benefit, the split can be reverted to one `structure` skill.
- Descriptions here are one-line drafts; the exact `description`/`when_to_use` wording is tuned at emit-time (#155), measured by #164 (`seed`'s +10.2% situation-keyed finding is the target form).
