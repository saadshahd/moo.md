# find eval

Measures `sound:find` and `sound:stack` on the six tools the user adopted from real sessions, and on the incidents they must not repeat.

Run: `./run.sh [haiku|sonnet] [trials] [case-id ...]` (default `sonnet 5`). `JOBS=4` sets the runs at once, `EFFORT=medium` the effort, `BUDGET=2` the dollar cap of one run. Cheap models only (`../model-guard.sh`). It needs `gh` signed in, the network and `claude`.

| Kind | The run | Scored |
|---|---|---|
| `pick` | the need in plain words, naming neither tool nor category | the tool's `owner/repo` appears in the reply (surfaced); the trace holds a `Skill` call to find (fired) |
| `quiet` | the same need in a project that already holds the tool, in its manifest and its CLAUDE.md `## Tools` | no `Skill` call to find and no fetch |
| `gate` | `sound:find` called by name with the need, a memory pick, and the instruction to judge rule 4 for it even when another rule fails | the memory pick is named as a pick, or not; the evidence for it was fetched; the `rule 4: pass` or `rule 4: fail` the reply ends the Memory pick line with |
| `stack` | `/sound:stack` in a project with hand steps | every `## Tools` line has the shape `<step>: use <owner/repo>; run <command> first`, no first command uses `npx`, `curl`, a shell or a pipe, and only CLAUDE.md changed; the lines written per run are reported, against the three tool gaps and one decision the fixture holds |

Every `owner/repo` named as a pick and every `Package:` line is checked against its live registry (`gh api`, npm, PyPI, crates.io) with no model. A reply that leaves find's output template names nothing to the scorer.

| File | Role |
|---|---|
| `cases.json` | the cases; each `source` is reworded, no session text |
| `run.mjs` | builds a throwaway project per trial in the OS temp directory, runs claude headless, scores |
| `readonly-shim.sh` | stands in for `gh` and `curl` in every trial and refuses any request that is not a read |
| `readonly-shim.test.mjs` | `bun test` proves the shim runs reads and refuses writes, with fake tools and no network |
| `BASELINE.md` | the rates, with the file hashes they ran on |

Isolation: `sound` loads with `--plugin-dir`, skills on, so find's description competes with the other skills as shipped. `--setting-sources project` and trial projects outside this repo keep user settings, memory and this repo's CLAUDE.md out; no MCP; hooks off. The init event is checked for other plugins. Allowed tools: read-only commands, web search and fetch; installs are refused by omission. A trial holds this machine's GitHub login and reads text it did not write, so `gh` and `curl` resolve to `readonly-shim.sh`: a write method, `--input`, a body, `graphql`, or any `gh` command beyond `api`, `search` and `repo view` exits 126 whatever the model was told. `npx skills find` still runs a package fetched from npm.

Limits:
- The author figures in `../../skills/find/author-gate.json` were set with the six finds' numbers known. Scoring them on the six fits the gate to its own test set.
- The author check passes a hijacked trusted maintainer. `gate-tanstack-query` is expected to pass and documents that.
- `huggingface-cli` returns 404 on PyPI, so that case fails because no package is there, not because an author fails. `react-codeshift` is the case that exercises the author check.
- The gate cases ask find to judge rule 4 even when another rule fails, so the author rates measure the check, not find's default.
- `pick` prompts are six needs, not a sample of real pick moments.
- Registry and GitHub figures change daily: a rerun reads a different world.
