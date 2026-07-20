# sound:review eval fence

Measures the `sound:review` skill (`../review/SKILL.md`) as a labeled pass-rate — per the
Model-Judgment rule, a model boundary has a *rate*, not a guarantee, and must be MEASURED on a
labeled set before it is trusted. `sound:review` ships **unmeasured-but-fenced**; this is the
fence (map #144, ticket #171).

## What it does

`run.sh` builds a throwaway git repo per case, commits any `base_files` (pre-existing code), stages
the `diff_files` (the change under review), installs the **full** sound corpus into `.claude/sound/`
(`install-sound-tree.sh`, topic-routed exactly as `sound:setup` emits it post-#170), then runs the
**real** skill — `claude -p` reads `../review/SKILL.md` and executes it against `git diff --cached` — the real
shipped skill, never a copied-out prompt (`run.sh`'s header explains why). Scoring is deterministic
(`score.mjs`) — verdict match plus a planted-keyword check that a VIOLATION was flagged on the RIGHT
rule. No second model scores anything.

```
./run.sh [--model haiku|sonnet] [--runs N] [--jobs K] [case-id-substring]
```

Runs fan out with a bounded pool (`--jobs`, default 4); each `(case,run)` writes its own row and
`.out`/`.err` under `runs/<stamp>/`. `--runs` defaults to 3 — one run is never a fact (the map
caught two eval runs disagreeing on borderline rules).

## Corpus (real, mined, human-relabelled)

Every case under `cases/` is **ported from `hope/hooks/slop-nudge.evals/`** — themselves mined from
real Claude Code sessions (json-render-editor + sport-events), never fabricated. Each is either an
agent-written VIOLATION or a hard negative (a CLEAN that looks like a violation but isn't); `cases/`
is the count.

Each was **relabelled onto a sound corpus rule** by the human (labeler of record) — slop-nudge
graded against the global `TASTE.md`; here the anchor is the installed `.claude/sound/` rule set.
`cases/<id>/label.json`:

- `verdict` — VIOLATION or CLEAN.
- `rule` — the planted corpus rule name (null on CLEAN cases).
- `base_files` / `diff_files` — pre-existing code (committed to HEAD, explorable, NOT in the diff)
  vs. the change under review (staged). Cross-file duplication cases (X01/X02/X04) put the owned
  equivalent in `base_files` and the added duplicate in `diff_files`, so review must Grep HEAD to
  find the owner and flag the dup — the real PR scenario.
- `must_mention` — deterministic anchor keywords; a VIOLATION scores TP only if one appears.
- `forbidden_anchor` (hard negatives) — the **pattern-specific** token(s) of the look-alike this
  case is a negative for; citing one is an over-fire. This drives the honest specificity (*Not-when
  respect*). Two kinds: **code tokens** where the look-alike IS an entity (`DropTarget`), **reason
  tokens** where the entity is legitimately flaggable by other rules so only the Not-when's concern
  counts (`over-abstraction`, not bare `AXIS_GEOMETRY`). Human is labeler of record (#172). Prefer
  this over a rule *name*, which over-counts (review can cite the same rule for a different instance
  — HN7). Even HN3, whose useEffect-count rule was dropped as C11, carries an anchor (`useEffect`)
  and scores its real 0/3 over-fire. See RESULTS.md.
- `forbidden_rules` (hard negatives) — provenance: the corpus rule(s) behind each look-alike.
  `score.mjs` falls back to this only when a case carries no `forbidden_anchor`.

One slop-nudge case was **dropped**: C11 (`2+ useEffects / raw useRef`) has no corpus rule — the
react-hooks-count taste never made it into the sound corpus, so measuring recall on it measures
nothing about what ships.

## Reading the results — two caveats that matter

1. **review is a DEEP review, not a single-rule judge.** Against the whole installed corpus a real
   file has *many* violations; the planted rule competes with every other genuine finding for review's
   attention. A WRONG or FN score here often means review found *other* real issues first, not that
   it is blind — read the per-case `.out` findings, never just the confusion matrix. This is the
   honest shape of the measurement, not a harness defect.
2. **Keyword-OR is a coarse recall proxy** (the map's known scoring blind spot). A generic anchor
   (`undefined`) can register TP on a finding that cites a *different* rule but happens to mention
   the token. Treat per-rule recall as a floor-ish signal, corroborated by the raw findings.

Both caveats push the same way: the rates are the headline, the `.out` files are the truth.
`score.mjs` prints per-rule recall, overall recall + wrong-flag, **two** specificity readings —
*Not-when respect* (the honest one: did review avoid citing the forbidden look-alike) and *strict
silence* (the crude one, inflated by fixture impurity) — an EXCLUDED count (non-answers, never
mis-scored as a verdict), and a run-to-run stability list (a rule that swings 3/3→0/3 has no
trustworthy rate). Measured rates of record: **RESULTS.md**.

## Scope (deliberately out)

Measures review's recall **given the bearing rule is installed** — the full corpus is planted (why:
`install-sound-tree.sh`'s header), so a miss is review's, never `sound:setup` not selecting the
rule. The `setup ∘ review` pipeline is a different question, out of this fence.
