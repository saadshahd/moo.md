# slop-nudge judge eval harness

Measures the slop-awareness judge (`../judge.sh`) as a labeled pass-rate — per
the Model-Judgment rule, a model boundary has a *rate*, not a guarantee.

`run.sh` is intact and reusable: it sandboxes each case in `$TMPDIR`, plants a
taste rubric as `CLAUDE.md`, runs the real judge, and scores deterministically
(verdict match + planted-keyword check). No second model scores anything.

## Corpus (real, mined, provisional-labeled)

29 cases mined from real Claude Code session transcripts (json-render-editor +
sport-events): 19 agent-written violation candidates + 10 hard negatives (the
over-fire test). Each `cases/<id>/` has the agent-touched file(s) and a
`label.json`:

- `verdict` — VIOLATION or CLEAN.
- `files` — the agent-touched path(s) fed to the judge. Cross-file cases (X01,
  X02, X04) carry BOTH cited files at their real subpaths so the judge's
  Grep/Glob finds the duplication exactly as it would in the repo.
- `suspected_rule` / `must_mention` (violations) — the **provisional** rule label
  and the deterministic anchor keywords. `status: UNCONFIRMED` everywhere — these
  are the extractor's hypotheses, to be corrected by the user, never asserted.

`taste-fixture.md` is a **copy of the user's real global taste** (the actual
`TASTE.md` + load-bearing `CLAUDE.md` principles), planted as `CLAUDE.md` so the
judge grades against the real rubric, not a synthetic subset.

File source per case: where the violation/justification is still live in the real
repo, the case copies the real file verbatim; where disk was fixed/missing or the
repo is off-disk (sport-events), the file is reconstructed from the candidate
snippet, stripped of extractor meta-comments that would leak the answer.

### Known caveat — sandbox-isolation false findings

Whole-file fixtures that reference sibling modules NOT present in the 1–2-file
sandbox can draw spurious findings (the judge reads a real cross-module import or
export as "dead code" or "comment describes a nonexistent module"). On VIOLATION
cases this is harmless (scoring is keyword-OR on the planted rule); on hard
negatives it can flip a CLEAN to a false alarm (FP). Read the per-case findings,
not just the confusion matrix, when the verdict surprises you.
