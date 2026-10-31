# lookup-first eval

Measures how often moo's skills follow one rule: turn to the user only for what no reachable source
settles; otherwise look up, read, or do the reversible in-scope step and report the result.

Run: `./run.sh [haiku|sonnet] [trials] [dev|heldout|real|all] [case-id ...]` (default `sonnet 3 all`). `EFFORT=medium` sets the effort, `JOBS=4` the runs at once (default 6), `HOOK=1` loads `hope/hooks/reach.ts` alone as a plugin, with hooks on.
Cheap models only (`../model-guard.sh`).

| File | Role |
|---|---|
| `cases.json` | dev cases: one per scout finding, plus guards that must still ask |
| `heldout.json` | cases written before the first run and not used to design any rule edit; run with `heldout`. On 2026-10-31 (sha256 prefix 689c9f310a96) every version's failures were sorted by hand and three measurement faults fixed, labels untouched: `ho-explain-proceed` gained the `scripts/publish` its doc names, and two literal checks (`31s`, `OTP-RULE-9`) now take equal wordings |
| `real.json` | cases rebuilt from real sessions where the agent asked what a source showed or handed over a step it could take, each naming its `source`; frozen before its first scored run (sha256 prefix 189235949e7a; on 2026-10-31 its `source` notes were reworded so no session text is published, every request, file and check unchanged, prefix 5dd0aaa4c82a); a two-case smoke run first fixed two harness faults: `bin/*` was not an allowed command, and `real-typesafe-key` checked for the key's value, which an agent rightly masks |
| `run.mjs` | builds a throwaway project per case, runs the skill passage headless, scores |

Case fields: `skill` (path from repo root), `at` (opening text of the passage; found by text so line
drift fails loud), `scout` (the scout's class), `label` (`proceed`, `ask`, or `ask-with-work-done`),
`request`, `files`, `expect`, and optionally `env` and `allow` (extra tools) for the run, and `disputed`: why the label may be wrong, for the user to rule; the report gives totals with and without these cases. A case with no `skill` sends the request alone, to measure what holds outside any skill. The answer lives only in `files`; the runner fails setup if an expected
string appears in the prompt.

Checks (all deterministic): the reply turns to the user or not (`turned()`, a text heuristic), the
answer is in the reply (`reply`, every string; `replyAny`, at least one regex), the source was actually reached (`looked`, in a tool result), the
finished act exists on disk (`present`, `absent`), and the reply holds no pattern in `replyNot`.

Isolation: `--setting-sources ""`, no MCP, no slash commands/skills, hooks off, default output
style; the run's `init` event is checked for non-builtin plugins and output style. Each trial's
project is its own git repo with one commit, so no outer repo's history leaks in. Writes are allowed
only inside the trial's dir; the prompt names its `scratch/` as the one place outside the project, so
a page "outside the repo" lands where `present` looks. `open` is a stub that does nothing. Two trials
of one case never run at once.

Limits: sound setup writes under `.claude/`, which `-p` mode refuses as a sensitive path whatever
the rules allow, so no case covers it. `turned()` is a heuristic and `ask` labels for `ask-with-work-done` pass on turning to the
user plus the prefilled values in the reply. Labels not marked `scout: ask-first/hand-over` agreeing
with `label` are decisions for the Door. Do not tune the rule against `heldout.json`.
