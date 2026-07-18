# sound — lazy delivery of the judgeable core (digest + on-demand bodies)

> Resolves map **sound: enforcement-split + lazy-load the judgeable core** (#144), ticket **#150**.
> Builds on `digest-membership.md` (#149, which tier each judgeable rule gets) and the #65 design (solo scratchpad, proj 4).
> Byte-preserves every rule law — this ticket changes DELIVERY, never taste text.

## What this ticket settled

1. **A measured loading model** (the Q4 sentinel — see below): where a file lives decides whether it loads at launch, and the #65 design placed bodies in the wrong place.
2. **A compliance eval axis** (`sound/evals/compliance/`, the Q1/Q2 instrument) that measures whether a one-line digest law holds compliance vs the full body — the load-bearing bet, now measurable per `correctness-is-a-measured-rate`.
3. **Phase-6's output shape** — the three-artifact shape below was **superseded by #162/#163**: the always-loaded digest is dropped, and the on-demand bodies are delivered by a small topic-grouped set of project-scaffolded `sound:<topic>` skills (not a hand-rolled index, not one generic skill). See §Phase-6.

## Loading model — MEASURED, not assumed (Q4 sentinel)

Two runs of a headless `claude -p` sentinel (no tools, so a reported token proves launch-load, not a Read) over four file placements. Stable across both runs:

| File placement | `paths`? | Loads at launch? |
|---|---|---|
| `.claude/rules/_house-laws.md` (pathless) | none | **YES** — wanted (the digest) |
| `.claude/rules/_bodies/<rule>.md` (pathless, subdir) | none | **YES** — *design flaw* |
| `.claude/sound-bodies/<rule>.md` (**outside** `rules/`) | n/a | **NO** — wanted (the body) |
| `.claude/rules/<rule>.md` with a non-matching `paths` glob | non-matching | **NO** |

**The refuted assumption.** #65 assumed pathless `_bodies/*.md` files "never auto-inject" and are pulled on demand. **False.** *Any* pathless file under `.claude/rules/` loads at launch — the `_` prefix and the subdirectory do not matter. Putting the ~53 pull-only bodies there would re-create the exact launch-dump this map exists to kill.

**The fix (platform-forced, not a style choice).** Bodies live **outside `.claude/rules/`** so they never auto-load. #150 placed them at `.claude/sound-bodies/`; **#163 superseded that** — bodies are now reference files **inside each topic-skill's directory** (`.claude/skills/sound-<topic>/<rule-name>.md`), which are also pull-on-demand (skill reference files load only when Read). Either way the measured constraint holds: pathless files under `.claude/rules/` always-load, so on-demand bodies must live elsewhere. See §Phase-6 for the live shape.

## Phase-6 output shape — REVISED by #162/#163

> The original spec here emitted a **three-artifact** shape whose first artifact was an always-loaded `_house-laws.md` **digest** of one-line laws. **#162 dropped that digest**: no available instrument can measure that a one-line law earns its always-loaded context cost (the deterministic axis is blind where violations are plausible; the LLM judge is 20–71% reliable vs the human on 4/5 semantic rules, unrescuable by prompt). **#163** then settled what surfaces an on-demand body once the digest — which was also the pointer at the bodies — is gone. What follows is the live spec.
>
> **#163 mechanism (why skills, why a topic-set).** The always-loaded surface must survive Claude Code's **skill-listing budget** (~1% of context, shared): with ~45 *separate* skills (one per delivered rule), low-frequency taste rules get their descriptions **dropped first** — the rules that most need surfacing lose their triggers. A hand-rolled pathless index avoids that but is custom code re-implementing native skill discovery, and its full table always-loads. A **single generic skill** is budget-safe but its vague `description` auto-invokes weakly. **A small topic-grouped set (settled at 7, #165) wins all three:** each is a listing entry too few to be budget-evicted, carries a *sharp* situation-keyed `description` that auto-invokes well, loads its sub-table only on invoke, is native (library-over-custom), and — being **user-invocable** — carries a deterministic `/sound-<topic>` fallback for when auto-invoke misses. The partition into topics is #165; #164 measures topic-set vs generic-1 vs baseline. The paths-on-skills gating semantics are **irrelevant here**: surface-gated rules stay as native `.claude/rules/` paths-*rules*, never skills.

`sound:setup` Phase 6 writes, for the confirmed set:

1. **A small topic-grouped set of `.claude/skills/sound-<topic>/SKILL.md` skills** (partition: **7 topics, #165**), each **`user-invocable: true`** and auto-model-invocable. *(#163 first picked ONE generic skill on budget grounds; #165 refined to a topic-set — a single skill's vague `description` auto-invokes weakly, while 7 sharp topic triggers stay well under the ~1%-context listing-eviction cliff. `generic-1` survives only as the degenerate fallback if #164 shows granularity buys no auto-invoke benefit.)* Each skill costs one always-loaded listing entry (name + a **sharp situation-keyed** `description`/`when_to_use` for its topic), never the bodies. Its BODY is the topic's **situation-keyed sub-table** — one row per rule it owns, over the **45 default-delivered** rules (single source for the derivation and per-topic assignment: `skill-partition.md` §Scope):
   `- <situation cue> → <rule-name>.md`
   The cue is **situation-keyed** ("naming a value/type", "modelling absence") — the *situation that should make you pull the body* — **never the law text** (the bright line from the dropped digest: the table carries the *question*, whose value is deterministically measurable via pull-through; the digest carried the *answer* at unmeasurable cost). Descriptions follow `seed`'s +10.2% situation-keyed-over-named-principle finding. A sub-table loads only when its skill fires (auto or `/sound-<topic>`); even if it re-injects per invoke it re-injects that topic's handful of rows, never the ~75KB of bodies.
2. **`.claude/skills/sound-<topic>/<rule-name>.md`** — one plain reference file **inside the owning topic-skill's directory**, per sub-table row, holding the full WRONG/RIGHT/_Avoid_/Detect/Not-when body, **byte-preserved** from the corpus. Pulled on demand — the agent Reads it when the sub-table cue fires; skill reference files do not auto-load. No separate `.claude/sound-bodies/` folder (rejected by the human: bodies are skill-internal references). Depth-1, each row → one file, never chained — honors CLAUDE.md "flat files alongside SKILL.md when essential" and "no reference chains".
3. **Surviving `paths`-rules in `.claude/rules/`** — the 28 surface-gated rules keep today's mechanism (react as `{tsx,jsx}`, db/distributed as a thin `paths`-pointer that fires only on a surface-file edit). They self-surface on their file subset with zero always-load when off-surface, so they stay `paths`-rules — **not** folded into the skill.

The `opt-in` 3 (`corpus-optin/`) are unaffected here — they are gated out of candidacy upstream (physical corpus split, #149/#153) and only ever install as normal per-rule files when explicitly named.

**Release gate (#164, blocks #155; #164 blocked by #165).** The set rests on "the right topic-skill auto-invokes and the model pulls the body when the situation cue fires." Before `setup` emits it, that must be **measured**, not assumed (`correctness-is-a-measured-rate`). The observer is deterministic: grep the trial transcript for the expected `sound-<topic>` skill auto-invoking **and** a `Read` on the expected `<rule>.md` reference when a triggering task arises. Three arms: `topic-set` (the #165 partition) vs `generic-1` (one vague-description skill, control) vs `baseline`. `/sound-<topic>` (manual) is the deterministic floor; the eval measures the auto-invoke + pull rate above it. #155 does not build the emit until #164 passes.

## Compliance eval axis (Q1/Q2) — `sound/evals/compliance/`

The load-bearing bet: **a one-line law keeps the agent compliant; the body is only needed for hard cases.** `score.mjs` measures INSTALL correctness, not downstream compliance — so this is a new, separate axis.

- **What it measures:** for a rule whose violation is the natural next edit, the share of trials that COMMIT the violation, under three delivery conditions:
  - `baseline` — no rule text in context (does the model violate unprompted? — the empirical basis of the `core` "Claude-doesn't-do-it-unprompted" hypothesis).
  - `digest` — only the one-line law (the digest line).
  - `body` — the full byte-preserved corpus body (the ceiling).
- **The bet, as a check:** `digest ≈ body`, and both `< baseline`. If `digest ≈ baseline`, the one-liner is inert and the rule belongs in pull-only (or needs its body). If `digest ≈ body ≪ baseline`, the digest line earns its place in `core`.
- **Zero-LLM detection:** each fixture greps the agent's fenced output for a crisp violation signature (`check.mjs`), same discipline as `score.mjs`. Unit-tested against known compliant/violating snippets.
- **Run:** `./run-compliance.sh [haiku|sonnet] [N] [fixture...]` → `tally.mjs` prints the per-fixture violation-rate table and the digest/body deltas.
- **This eval is the labeler of record for `core`** (`digest-membership.md` §3): the 21 core members (post-#154) are a hypothesis this axis promotes/demotes.

### Fidelity caveats (read before trusting a number)

- **Prepend, not scaffold.** Conditions deliver rule text by prepending it to the task prompt, not by scaffolding `.claude/rules/`. This isolates *the effect of the text* from *loading mechanics* (already settled by the sentinel). A digest line loaded as a launch instruction may land slightly differently than the same text in a user turn — a known, deliberate simplification.
- **Model.** The pilot runs on **haiku** (weakest → most likely to violate at baseline → best signal per token). Sonnet is the truer proxy for real work; Opus is refused by the runner (eval cost = live cost preview, per repo convention). A digest that helps haiku is evidence, not proof, for stronger models.
- **Sample size.** The pilot is N=5/condition over 2 fixtures — enough to prove the instrument discriminates and to read a direction, NOT enough to settle a borderline `core` member. Two prior install-eval runs already disagreed on borderline rules; treat any single delta as a prompt to look, not a fact.

## Measured pilot result

Model haiku, N=5/condition, 2 fixtures (`absence-terse`, `exhaustiveness`), both fail-loud guards active (0 excluded):

| fixture | baseline | digest | body |
|---|---|---|---|
| absence-terse | 0% (0/5) | 0% (0/5) | 0% (0/5) |
| exhaustiveness | 0% (0/5) | 0% (0/5) | 0% (0/5) |

**A measured NULL result, honestly reported.** The delta is 0pp everywhere — **not because the digest failed, but because baseline is already at the compliance floor.** Inspecting the baseline outputs: haiku unprompted writes `raw ?? fallback` and reaches for a `Record<Status, string>` map (a compile-time-exhaustive shape) — the *right* shape, with no rule text in context at all. There is no violation for the digest to prevent, so the load-bearing bet is **unsettled, not confirmed and not refuted**, by this pilot.

This re-confirms the eval-discipline lesson empirically: **fabricated single-function fixtures on a capable model do not reproduce violations** (the "6/6 = no discriminating power" trap). Signal requires fixtures that reproduce REAL agent-written violations under realistic multi-file pressure — exactly how the *install* eval's fixtures were mined from real repos — and/or the model that actually does the work (sonnet/opus), not a toy on haiku.

**What this does and does not license:**
- It does **not** demote `absence-terse` / `exhaustiveness` from `core` — 2 rules × 1 model × N=5 fabricated fixtures is a signal to look, never a verdict (`correctness-is-a-measured-rate`).
- It **does** establish that the compliance axis is built, deterministic, fail-loud, and runnable — and that its *fixtures* are now the gating work, not its machinery.
- It **does** guard against the opposite error: asserting "the one-liner works" from a single leading fixture (the first pilot's exhaustiveness task telegraphed the answer — corrected here).

## Owed downstream (fog cleared / still open)

- **Re-run reconciliation** (map Fog): a re-run reconciles each topic-skill's **table body** (derived — regenerated wholesale each run from the confirmed set) against the **skill-internal reference bodies** (`.claude/skills/sound-<topic>/<rule-name>.md`, user-owned-once-written, reconciled by the existing prose-only diff, SKILL.md "Re-runs"). *(Revised by #163/#165 — the reconciled artifacts are the topic-skill tables + skill-internal bodies, not a digest + `.claude/sound-bodies/`.)*
- **Scale the compliance eval** beyond the pilot (more fixtures, higher N, a sonnet pass) before promoting/demoting any borderline member. The eval is the instrument; the pilot is not the verdict.
- **#152 lint** still hoists `branded-primitives` + `exhaustiveness` into the lint layer when it ships — with the digest dropped (#162), they go straight to lint (or stay as `paths`-rules until it lands), not through any always-loaded tenancy.
- **Rewrite `sound:setup` SKILL.md Phase 6** (ticket #155) to emit the shape in §Phase-6 above — the `sound` skill + skill-internal bodies + surviving `paths`-rules (currently emits one `.claude/rules/<rule>.md` per rule). Separate implementation ticket, gated by #164; this ticket specifies the shape, it does not rewrite the skill.
