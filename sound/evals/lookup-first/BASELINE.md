# Baseline (sonnet, medium effort, 3 trials per case, 2026-10-31)

Four versions on one harness, each a worktree of 86dbbbf: the old skills; a look-it-up-first clause in 16 skills; `hope/hooks/reach.ts` alone (`HOOK=1`); the hook plus the ask lines of elicit, clarify, explain, draft, land and learn scoped to what sources in reach leave open. Files as run: cases.json b5e7b4c8382a, heldout.json 689c9f310a96, real.json 189235949e7a. Per case: `baseline.txt`.

| split | class | old | clauses | hook | hook+lines |
|---|---|---|---|---|---|
| dev | should-proceed | 33/78 | 37/78 | 38/78 | 40/78 |
| dev | should-ask | 16/24 | 23/24 | 23/24 | 21/24 |
| heldout | should-proceed | 4/12 | 4/12 | 4/12 | 8/12 |
| heldout | should-ask | 5/6 | 6/6 | 6/6 | 6/6 |
| real | should-proceed | 17/24 | 15/24 | 18/24 | 18/24 |
| real | should-ask | 5/6 | 1/6 | 5/6 | 5/6 |
| all | all | 80/150 | 86/150 | 94/150 | 98/150 |
| all | undisputed | 78/141 | 83/141 | 91/141 | 95/141 |

A hand audit of every failure, one auditor per version, found about 31 real faults (asked what a source settles, or handed over a step it could take) in the old skills and 16 to 24 in the other three. The auditors split on the same reply shapes by about 5 faults, so those three are not told apart; a blind audit per case is the next measure.

What still fails:
- elicit asks after reading the answer, 0/6 in every version: its offer-and-wait loop wins over the hook and the scoped line.
- `real-typesafe-key` never runs `env` before asking for the key; `real-shared-browsers` never reads the README before saying "run it yourself", passing only on its label.
- Fixtures that name a file they lack make the ask legitimate: `intent-open`, `explain-missing`, `real-run-test`, `land-brief`, `anchor-judgment`.
- The sandbox refuses `gh`, `bun` and `command -v`, and `AskUserQuestion` is absent in `-p` mode, so every skill's ask becomes prose.
