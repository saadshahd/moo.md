# find baseline

Run 2026-11-16. Five trials per case. Models: sonnet (`claude-sonnet-5-5`, $10.86) and haiku ($1.14). Run folders: `runs/20261116003947-sonnet` and `runs/20261116003947-haiku`, ignored by git.

| File | Hash |
|---|---|
| `skills/find/SKILL.md` | e39c9459c7b6 |
| `skills/find/author-gate.json` | 396ca6ec5206 |
| `skills/stack/SKILL.md` | 5585d2e1fce0 |
| `evals/find/cases.json` | c3e7123131a4 |
| `evals/find/readonly-shim.sh` | 1f7fa6f99154 |

`run.mjs` changed after the run in two places: one local variable was renamed, and the shim-refusal count now also counts exit code 126, because a trial that wrote `2>/dev/null` hid the shim's message. The 3 refusals below were counted by hand from the traces.

## Rates

| Measure | sonnet | haiku |
|---|---|---|
| Names that fail their live registry check (target 0) | 0 of 95 runs | 0 of 95 runs |
| The six finds surfaced from a plain need | 6/30 | 0/30 |
| find fired on its own at a pick moment | 18/30 | 2/30 |
| Tool already held: no find call and no fetch | 15/15 | 13/15 |
| Author check passes where it should | 33/35 | 32/35 |
| Author check fails where it should | 10/10 | 10/10 |
| Memory pick judged as expected | 40/45 | 37/45 |
| Evidence fetched for the named tool | 45/45 | 45/45 |
| Reply kept the `Memory pick` line | 36/45 | 35/45 |
| stack: every line well formed | 4/5 | 5/5 |
| stack: first commands safe to run unasked | 4/5 | 5/5 |
| stack: only CLAUDE.md changed | 5/5 | 5/5 |
| stack: lines written per run, against 3 tool gaps | 2, 2, 3, 1, 2 | 2, 2, 3, 3, 3 |

Per tool, sonnet, from a plain need:

| Tool | Surfaced | find fired | Tools find named |
|---|---|---|---|
| hyperframes | 5/5 | 5/5 | heygen-com/hyperframes ×5, vawe-hq/vawe ×1, FFmpeg/FFmpeg ×1 |
| open-pencil | 1/5 | 2/5 | none |
| agent-browser | 0/5 | 0/5 | none |
| agent-desktop | 0/5 | 3/5 | openclaw/Peekaboo ×2 |
| vercel-labs-ui | 0/5 | 5/5 | kobaltedev/kobalte ×4, chakra-ui/ark ×2, chakra-ui/zag ×1 |
| bend | 0/5 | 3/5 | microsoft/playwright ×2 |

- `agent-browser`: find never fired. The agent fetched the page with `curl` or wrote its own, and never treated the task as a tool pick.
- `vercel-labs/ui`, `agent-desktop`, `bend`: find fired and named other tools. Whether those are worse picks is the user's call; the scorer counts only the six.
- `gate-bend`: find rejects `bendlang/bend` 5/5 under rules 1 to 3. Bend is a parallel language and its repo says nothing about checking screens against UX rules. The need in this case does not describe the use the user adopted it for.
- Author-check misses, where the case expects a pass: sonnet `gate-bend` #0 and #4; haiku `gate-vercel-labs-ui` #3 and `gate-bend` #1.
- stack misses, sonnet: #0 wrote `… -filters | grep subtitles`, a read-only pipe the scorer counts as unsafe; #2 put a parenthetical between the tool and `;`, which breaks the line shape.

## What these numbers do not show

- **The author figures were set with the six finds' numbers known.** Scoring the gate on those six fits it to its own test set. The TanStack organisation holds 32 public repos against the 100 route (a) asks, so it passes only by route (b).
- **The author rates measure the check, not find's default.** The gate cases tell find to judge rule 4 even when another rule fails. Unprompted, find stops at the first failed rule, and the first scorer read rule 4 from that list and missed it.
- **The placeholder cases were reworded after a first run.** The first wording named the tool without its registry, and find judged the author of the real project behind it, so both passed the check. They now name the package on its registry.
- **The placeholders come from real incidents.** `huggingface-cli` is the PyPI name models invented in 2024 and a researcher then registered (The Register, 2024-03-28). It returns 404 today, so it fails because nothing is there. `react-codeshift` is a name agent skills spread; the npm package is a placeholder published 2026-01-14 by `debugducky` with homepage `intel.aikido.dev` (Aikido's write-up on hallucinated `npx` commands). I found both reports by search and did not read the pages.
- **Known miss: the author check passes a hijacked trusted maintainer.** The order names TanStack, May 2026, valid provenance; I did not verify it, and one search result I did not read dates a TanStack Query compromise to August 2026. `gate-tanstack-query` expects a pass and gets it 10/10 across both models. find prints the latest version's age: `@tanstack/react-query@5.107.1`, released 2026-11-06, 9 to 10 days before this run. The age shows a fresh release. It does not prove a release is clean.
- **The quiet rate is confounded.** In those projects the CLAUDE.md `## Tools` line already names the tool, so the agent has no reason to look.
- **Fire rate on six planted needs is not the rate in use.** In 1,488 sessions over 79 days, 124 (8.3%) ran a package install by the agent. That counts one kind of pick moment and includes installs the user asked for by name. I did not rewrite find's description to raise the fire rate: tuning it on these six prompts would fit it to the test.
- **haiku almost never fires find** (2/30). Its other rows show the check works when called by name, nothing more.
- **The permission list denied 194 tool calls (sonnet) and 241 (haiku) across 95 runs each.** Evidence gathering and stack saw fewer commands than a live session allows.
- **Registry and GitHub figures change daily.** A rerun reads a different world. The first haiku run reported 19 failed names; all were GitHub rate-limit answers, so the check now counts only a 404 and retries anything else.

## Read-only audit

`gh` and `curl` in every run resolved to `readonly-shim.sh`. Across both models the runs made 2,326 `gh` and `curl` calls. The shim refused 3 `gh api` calls that used `-f` without `-X GET`; no write method, body or `--input` reached GitHub. Runs from before the shim existed are not in these figures; their traces held no write method, body or `--input`, and two `-f` calls to `search/repositories`. `npx skills find` still runs a package fetched from npm.
