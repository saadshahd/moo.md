# GitHub agent factories: what the factory is made of, in plain words

Nothing is built. Sources: Claude Code and GitHub docs, addyosmani/factory,
open-gsd/gsd-core, Pi Durable source, recent factory write-ups (Jun–Oct 2026),
`~/repos/meta-harness` and hunch's pane code.

## Rule for every part below
A part gets a name only if you touch it or see it. Machinery you never touch has no
name for you to learn; it is listed once under "Hidden" so the plugin can build it.
The unit of work is the **GitHub issue** — a word you already use.

## What the research changed
| You thought | The research found |
|---|---|
| meta-harness wastes tokens when runs get killed | The 25-minute kill fired in 0 of ~40 sampled builds. The waste is a long build re-reading its context every turn: 16.2M tokens read for 49k written. |
| The work loop must take one issue at a time | addyosmani/factory takes one issue per *run*. Several runs at once are safe: each claims its issue by pushing a fixed branch name, and the first push wins. |
| Durable runs need an engine like Temporal | Those engines see a Claude Code process as one opaque step and can only redo all of it. What survives a kill is written work: the sealed plan, the branch, a handoff note. |
| A stuck run can't be reached | A hook can read the issue's newest comment after each tool call and pass it to the agent, or stop it. |

## Parts you touch or see (audit: why it exists, what it gives you)
| Part | Why it exists | What it gives you |
|---|---|---|
| Your rules (one committed file) | Your taste and soundness rules, and how many issues run at once | One place you change behaviour |
| How many at once | You asked to set the limit yourself | Speed you control |
| The plan, per issue | You review approach, not lines | You see each issue's approach before any code exists, when a change costs least |
| A note to a running issue | Today you can only cancel a stuck run | You unstick it without losing its work |
| Checks | They catch slop so you don't read code | A PR can't merge while a check fails |
| Cost per merged PR | Today Claude spend on Max is hidden in logs | One number to judge the factory |
| Stuck and waiting list | You need to know where to look | Plans awaiting you, stuck runs, slots in use |

## Hidden (built by the plugin, never named to you)
| Machinery | Who already does it |
|---|---|
| Finding issues with no open blockers | GitHub issue dependencies |
| Starting runs up to your limit, one picker at a time | meta-harness `loop/builder.py` pick |
| Stopping two runs from taking one issue | addyosmani/factory fixed branch name |
| Continuing a killed run in a fresh session | sealed plan + branch commits + handoff note |
| A note for the next run on what is left | addyosmani/factory handoff comment |
| Holding an issue while its plan waits for you | the run waits on its ask, and agent view shows it waiting; other issues go on |
| Sealing the approved plan so a later edit revokes approval | Foreman's hash seal |
| Cutting test logs to failures before the agent reads them | Claude Code hooks |
| Keeping docs from growing | live state stays in GitHub; size caps on committed docs |

## Choices made (2026-10-26)
| Choice | Picked | Lost |
|---|---|---|
| Plan approval | replaced: you are not the blocker (see Asks) | every issue blocks |
| Note on a running issue | both: type into the run (`claude attach`), or comment on the issue from anywhere; a hook passes the newest comment within about a minute. Stop: `claude stop` | cancel-and-edit; a stop label |
| AI reviewer | keep; comments only until its hit rate on past PRs is measured | cut |
| How a killed or approved run continues | fresh session from sealed plan + branch + handoff note | restoring the saved conversation (fragile in Actions) |
| Who merges a green PR | the factory, by GitHub auto-merge on required checks; you can revert | you, one click |
| Where the worker runs first | your Mac | an always-on boxd VM |
| Whose taste the code meets | the target project's owner's: the rules file names where it lives, and the loop applies each rule on its layer | one taste file for every project |
| Plan depth | design level: types, signatures, files changed | approach only |
| What the pane owns | only what agent view lacks: plans waiting for you, calls to reverse, stuck reasons, cost per merged PR; opened by `/factory` | the whole factory view; no pane |
| Where you see and answer it | inside Claude Code: agent view for runs, `/factory` for the rest; GitHub only stores | roundup app, phone, GitHub screens, hunch |

## Fixed by you (2026-10-26)
- No Python. One language for loop and pane: **TypeScript** (verdict below).
- Your own subscription only: Claude Max, Codex/ChatGPT nice to have, no API key.
- Its own plugin, with its own Claude Code mod module, separate from hunch.
- You are never the loop's blocker; how much it involves you is a setting you control.

## Language: TypeScript
The pane must be TypeScript: Claude Code mods are `.tsx` (`hunch/hooks/tend.tsx`).
The loop calls the `claude` and `codex` commands rather than an SDK. A Max login
is meant for the unmodified binary, not for an SDK-built product. The loop mostly
waits on `gh` and model calls,
so it gains nothing from Rust or Go speed. Either would add a second language.

## How the loop talks: moo's skills at each step
Each run is a background Claude Code session (`claude --bg`) with hope installed. The issue is its input.
`hope:compose` invokes each skill when its condition arrives:
```
1. issue → run    intent: turn the issue into a work order
                  clarify/elicit: something only you know → a call or
                  a question (see Asks), this issue parks, others go on
2. run            shape: pick the path, design-level plan (types, files)
                  inversion: what fails → constraints on the plan
                  target: the done-check, a cap, what must keep passing
                  anchor: any "clean"/"better" → a check a machine can run
3. run → you      a call: a choice the agent made, at the highest level
                  you can react to, cheap to undo (moves/call.md)
                  reduce: the plan and calls cut to the shortest version
                  that still covers everything
                  explain: the one settled fact you need to judge it
4. run            build against the sealed plan; a note typed into the
                  run lands at once, an issue comment within a minute
5. run → checks   deterministic gates, then judge: does the PR meet the
                  issue and the target's done-check?
6. run → next run handoff note, reduced; 2 failed fixes → inversion
                  or reframe before asking you
7. merged → you   widen: a real case no rule decides → a proposed new
                  rule; anchor turns it into a check
```
**The one seam:** a hook on `AskUserQuestion` in factory runs. Each skill already
asks through it. Using your setting under Asks, the hook either refuses the ask,
so the agent takes its pick and posts it as a call, or lets it through, so the run
waits and agent view shows it as waiting.

## Asks: when the factory waits for you
- Rule (from `moves/call.md`): the agent waits for you only when undoing a choice
  costs more than asking. Only that issue waits; the others keep running.
- Every other choice goes ahead. It is posted as a call you can reverse from the
  pane; a reversed call opens a fix issue.
- A daily cap on waits, set in your rules file. Past the cap, the agent takes its
  recommended pick and posts it as a call.
- Lost: a rules list of what needs you, and answering only in batches.
- Open check: the rule only works if the agent judges undo cost well. Measure that
  on past PRs before trusting it, the same way as the AI reviewer.

## The limits you hit
| Limit | Fact that decides it | Cheapest fix |
|---|---|---|
| Claude/Codex usage | All parallel runs share one Max account; a limit hit stops them all. Today the factory sees only "no work done" and no reset time. | Read Claude's "rejected" event and its reset time; start no runs until then |
| GitHub API | Your own `gh` login: 5,000 calls/hour. A comment check per run per minute, 4 runs → ~240/hour. | Ask with a saved ETag; GitHub doesn't count "unchanged" answers. |
| Actions | Only if runs move back to Actions. Minutes are free (public repo). Team allows 60 jobs but 5 macOS jobs. GitHub dropped ~93% of the 15-minute watch runs. | Chain runs by dispatch, never by schedule. Own runners only for dispatch-only jobs: strangers' fork PRs could run on them. |

## What Pi Durable teaches (github.com/earendil-works/pi `packages/durable`)
Verdict: keep Claude Code. Pi Durable is a library you build a host program around.
It has no MCP. It can't share a store between processes. Running it in Actions is
undocumented. Copy five ideas:
| Idea | Where it lands in ours |
|---|---|
| Three kinds of note: steer now / start after this run / display-only | note on the issue gains a "next run" and an "FYI" kind |
| Save a tool call before it runs; on restart, report it as cut off, never rerun silently | handoff note lists the step cut off |
| Use the note's ID so a restart never takes a note twice | the GitHub comment ID |
| After N crashed restarts, park the run as blocked with a reason + retry | pane row "stuck" |
| Show queued notes before they land, cost per model, blocked reasons | the `/factory` pane |

## What durable-pi teaches (github.com/disler/durable-pi)
We copy its ideas whichever runtime we pick. Pi Durable itself is used only if it fits.
Its point: agents are long-lived processes on a machine you own, not jobs that
start and die. "It works for you, then waits."
| Its idea | What it changes in ours |
|---|---|
| Agents run on a long-lived machine (your Mac, a VM over ssh) that owns their saved state; GitHub-style events only wake them | Actions runs die after each job. A machine of yours that stays up keeps runs alive, and your logged-in subscription works there with no token in CI (meta-harness already has boxd VMs) |
| Event-started agents: a log line or a failure starts work, not only a prompt | Factory input widens past issues: red CI on main, an error log, a stale PR |
| Durable job: named steps saved as they finish; one step waits for a human | Steps 1–7 of our loop become saved steps; a wait parks one step, not the machine |
| "Checkpointed, not exactly-once": an outside effect may happen twice around a crash | Opening a PR or posting a comment must check whether it already happened |
| Code sets limits and effects, Jev only classifies | Jev judges undo cost for Asks; code applies your daily cap |
| One shared state store; a stale write gets a conflict | Picker state: a stale write fails instead of overwriting |
| Hub keeps no run state; every screen rebuilds from snapshot + changes | The pane holds no state; it redraws from what the machine reports |
| Uses an OpenRouter API key | Conflicts with your subscription-only rule; don't copy |

## Where runs live: your machine (picked 2026-10-26)
Your Mac, or an always-on boxd VM, runs Claude Code background sessions under your
login. GitHub stores issues and runs checks. Lost: Cloudflare, Anthropic's cloud,
GitHub Actions.

**Worktrees: worktrunk (`wt` v0.80, already installed; you used it on the work project)**
| Need | worktrunk part |
|---|---|
| One worktree per issue | `wt switch --create <branch>` |
| Warm start (deps, build caches) | `wt step copy-ignored` from a warm main worktree, in a `post-start` hook |
| Clean up merged work | `wt step prune` (merged into main, older than `--min-age`) |
| Clean up abandoned work | not covered: the picker runs `wt remove` when an issue closes or its run has been stopped for longer than a limit you set |
| Kill a run's processes with its worktree | `wt step tether -- claude …` (experimental) |
| See every worktree's state | `wt list --format json` |

**Scale.** One Max account caps how much model work happens, however many
machines you add. More machines help only when CPU, memory or disk is the limit.
- Every machine runs the same worker with its own N.
- The first-push branch claim stops two machines from taking one issue, with no
  central server.
- A boxd VM can be forked to add a warm machine.
- Unverified: whether boxd fork keeps worktrees warm.
- Agent view, `claude attach` and the worker's watch see only their own machine.
  So the `/factory` pane builds its list from GitHub (claimed branches, labels,
  plan comments), never from one machine's agent view; a note typed into a run
  on another machine goes over ssh, and an issue comment reaches it anywhere.

## Where runs could live (compared 2026-10-26)
| Option | Your subscription | Survives a crash | Notes + stop | What breaks first |
|---|---|---|---|---|
| Your machine: `claude --bg` + `claude agents --json` (Mac, or an always-on boxd VM) | yes | yes; a supervisor restarts it, and `claude respawn` restarts runs after a reboot | yes, built in; a waiting run shows `blocked` | the Mac must stay on, or pay for a VM |
| Cloudflare: one Durable Object picks work, one per issue holds its state, a Sandbox per run | allowed by the terms; the token in a Sandbox is unverified | the control state yes; the container dies at any time, so runs restart from the pushed branch | you build it | Max limits; container kills |
| Anthropic cloud: scheduled tasks on GitHub issue events | yes, always | partly; the VM is reclaimed when idle | a note via `claude -p … --cloud <id>` | no documented way for a local pane to read its state |
| GitHub Actions (today) | via `setup-token` | no | no | runs die with the job; 1,000 API calls/hour |

These apply wherever runs live:
- Drive the unmodified `claude` command. Anthropic expects products built on the Agent SDK to use API keys.
- Running N at once on Max fits the terms only as "ordinary, individual usage". Max limits stall every run at the same moment.
- Worker sessions must accept notes from other sessions, or your notes wait for approval.
- When a login expires, every run stops at once, so renew it early.

## TypeScript harness frameworks (surveyed 2026-10-26)
Only harnesses that start the real `claude` binary can run on your subscription.
Every framework that calls the model API itself needs a key. That rules out Vercel's
durable-harness, AgentRun, Mastra's Claude wrapper, Inngest AgentKit, LangGraph.js,
the OpenAI Agents SDK, VoltAgent, Effect AI and Cloudflare's Project Think (its loop calls the AI SDK through `getModel()`; checked 2026-10-26). Pi is ruled out too, and with it Flue (flueframework.com, built on Pi; checked 2026-10-26): Anthropic can
refuse its system prompt on a subscription token.
| Closest | Why look at it |
|---|---|
| Archon (coleam00/archon, TS) | Runs Claude Code and Codex through their own CLIs on your login. It has a worktree per run, approval waits as "attention items", and issue → PR built in. Gaps: no live steering; crash resume undocumented |
| Trigger.dev v4 self-hosted | Waits as tokens a GitHub comment can complete; input streams for steering. Heavy to host; subscription use untested |

Settled conflict: one agent said to build on the Agent SDK with a `setup-token`.
Anthropic's docs bar third-party products from offering claude.ai login through
the Agent SDK without approval. moo is a published plugin, so it drives the
unmodified `claude` command (`--bg`, `agents --json`, cross-session notes, `stop`).
Lost: Agent SDK streaming input, which is the same features in-process.

Ideas to copy:
- Write what a call intends before it runs and its outcome after. After a crash,
  the model is told the call "possibly ran".
- A wait is a token a GitHub comment can complete. Check who answered. An answer
  posted before the wait began still counts.
- One owner drives a session at a time.
- The issue tracker is the control plane. A checker restarts stalled runs (OpenAI Symphony).
- A pause shows one item: what it is, why it matters, a recommendation, the choices.

## What rstack teaches (github.com/michaelshimeles/rstack, audited from code)
It is not a factory. It is seven skills plus a workflow text that one agent follows,
from branch to reviewed PR. Nothing enforces or measures the text.
| Copy | Evidence |
|---|---|
| Reserve a record before posting, so a rerun can't post twice | unit-tested, same file `:155-158` |
| Name every stop state (cap, timeout, tool down, needs a scope call); never call a partial run complete | prose only |
| Check open PRs for overlapping files before starting | prose only |
Dropped: tying a review verdict to the exact commit. A rebase onto a new base
doesn't change the verdict, and required checks rerun on every push anyway.
Warning: its finish line is an unmeasured AI score (Greptile 5/5). Our AI reviewer
stays comment-only until its hit rate is measured.

## What recent work teaches (Jun–Oct 2026)
Nothing found sets up a GitHub factory and also gives a pane inside Claude Code.
| Source | Lesson | Hits which choice |
|---|---|---|
| CVector `claude-code-session`, Anthropic long-running harness post, Fork-and-Flush paper | Restoring a saved conversation in Actions breaks easily; a fresh session from a written plan works better | changed: continue from the plan |
| Dex Horthy, "Why Software Factories Fail" (HumanLayer) | A no-human-reads-code factory broke in months; the plan you approve must show types, signatures, file changes | plan approval, AI reviewer |
| Foreman | Seal the approved plan with a hash; an edit revokes approval | plan approval |
| Google Jules | Plans that approve themselves on timeout fail | confirms: wait for you |
| coleam00 dark-factory | An AI picker invented work; plain code picks, unfinished work first, needs-human after 2 failed fixes | picker |
| Morkeeth, "Where the tokens go" | 42% of spend was agents watching agents; check from outside the model | note checks, cost |
| Claude Code agent view (`claude agents`) | Lists only local background sessions; `-p` runs never appear | confirms: moo owns the factory pane |
| Claude Code Projects (docs point here for cloud) | Starts and tracks parallel cloud sessions from one chat | unread: could replace Actions as the place runs happen |

## The `/factory` pane
Its own mod module. It copies the pattern hunch's tend pane proved (`hunch/hooks/tend.tsx`):
- a click runs a command directly, with no model turn: `[Approve]` runs
  `gh issue edit 42 --add-label …`
- it redraws only when the data changed, and shows a repeated error once
- New: a slow GitHub poll on your own token, which has its own 5,000/hour.
- Run auth: runs use your own `claude` and `codex` logins on the machine. Make
  sure no `ANTHROPIC_API_KEY` is set, because it silently overrides the subscription.

## Unverified, decides whether a part stays
| Claim | Check |
|---|---|
| A hook on `AskUserQuestion` fires in a `claude --bg` run, and hope skills run there | one `--bg` run with hope installed |
| The `codex` command runs unattended on a ChatGPT login | one run; `codex login status` already says "Logged in using ChatGPT" (codex-cli 0.163.0) |
| The work gateway keeps prompt caching | `claude -p hi --output-format json` twice; 2nd `cache_read_input_tokens` > 0 |
| A $ cap works on a Max login | one capped run (spends Max usage) |
| Units of Claude's reset time; real limit-hit error text, as a `--bg` run sees it | capture one real limit hit (spends Max usage) |
| A `--bg` run's token use is readable, for cost per merged PR | confirmed for local sessions: each transcript turn carries `usage` (input, cache read, output); a `--bg` one unchecked |

## Final shape (proposed 2026-10-26)
Every part gets built. The build order only changes which risk shows first.

**What gets built**
```
factory/  a new plugin in moo.md
  your rules file, in the target repo   N at once, daily wait cap, checks
  worker: TypeScript on bun, kept up by launchd, on your Mac
    pick    unblocked issues, unfinished first, up to N
    claim   push the issue's fixed branch; the first push wins
    start   wt switch --create, then claude --bg with hope; run name = issue
    watch   claude agents --json: done, waiting, stuck; restart a killed run
            from sealed plan + branch + handoff note; 3 crashes → stuck
    limits  read the "rejected" event and its reset time; start nothing
            until then
  hooks
    ask     AskUserQuestion: refuse it (a call) or let it through (a wait),
            by undo cost and your daily cap
    seal    an edit to an approved plan revokes the approval
    logs    cut test output to failures before the agent reads it
    notes   after a tool call, at most once a minute: the issue's newest
            comment → passed to the agent
  pane      /factory: plans, calls, stuck reasons, cost per merged PR
```
Not built, because Claude Code, worktrunk or GitHub already do it: the run list
(agent view), stop (`claude stop`), restart after a reboot (`claude respawn`),
worktrees (`wt`), checks (required checks on main), a note typed into a run
(`claude attach`).

**How you'll know each bar is met**
| Your bar | The check |
|---|---|
| The choices fit you | Every row above traces to your words on 2026-10-26; the plugin's name is the only open choice |
| The outcome meets your expectations | Ten real issues from one of your repos run unattended. Pass: each merges with checks green, you touched only plans and calls, and you can read the cost per merged PR |
| The ask hook judges undo cost well | Before trusting it: its call vs yours on 20 choices from past meta-harness PRs |
| The code meets the project's taste | The rules file names where the project's taste lives (its CLAUDE.md, a taste file). Each rule lands on one layer: one a machine can check becomes a required check (anchor writes it); a design rule goes into the plan step (shape); the rest goes to the judge's PR comment, which has a hit rate, not a guarantee, so it never gates alone. You review approach, not lines |
| The plugin's own code meets moo's | `tsc` strict, tests and the anti-slop Oxlint rules as required checks; moo-authoring and your global CLAUDE.md for the rest |
| The pane matches what you expect | Your tend rulings: fewest rows, bracketed buttons, a click runs a command with no model turn, nothing pushed into your thread, an answer is a sentence you finish. Prototypes you drive live before any build, as with tend A–F |

**What it costs you**
| Part | Your time | Past build it is judged from |
|---|---|---|
| worker + hooks | ~1 h answering design calls | meta-harness loop: 7,200 Python lines, built over 25 days |
| pane, if any | ~1–2 h driving prototypes | tend: 1,537 lines, Sep 22 – Oct 1, six prototypes |
| ten-issue trial | ~1 h approving plans | none yet |
No calendar estimate: build time for this one is unmeasured, and Max limits at N
runs could stretch the trial.

## The route, from inversion (2026-10-26)
What makes the factory certain to fail, each turned into a line to follow:
- Run a smoke issue end to end as each part lands; never wait until every
  part is built to run anything.
- Run the free unverified checks before the parts that rest on them.
- Reject a plan that lacks types, signatures and files changed; a check, not
  the agent, decides.
- Start a fresh session from plan, branch and handoff note once a run's context
  passes a cap you set; never let one session re-read 16M tokens.
- Pick only issues you labelled for the factory, in plain code; never let a
  model choose or invent work.
- Stop a run after 2 failed fixes and mark it stuck with the reason.
- Start no run while Claude reports a limit; resume at its reset time.
- Refuse to start the worker while `ANTHROPIC_API_KEY` is set.
- Hold the Mac awake (`caffeinate`) while any run is busy.
- Check for an existing PR or comment before opening or posting one.
- Skip an issue whose files overlap an open PR's; take it after that PR merges.
- Calibrate the ask hook on past choices before it decides alone; until then,
  every ask waits for you.
- Keep the AI reviewer to comments until its hit rate on past PRs is measured.
- Put nothing in your main thread; `/factory` shows only what you open.
- Map every taste rule to a layer at setup, and list the rules that map to none.
- Remove a worktree when its issue closes or its run stops.
- Turn on auto-merge only on a repo whose main requires the checks; refuse
  to start the worker on one that doesn't.

## Targets (locked 2026-10-26)
Two contracts: one ends the build, one judges the factory.

**1. The build is done**
| Part | Value |
|---|---|
| Observable | issues closed by a merged factory PR, out of 3 smoke issues |
| Command | `gh pr list --repo saadshahd/factory-smoke --state merged --json closingIssuesReferences,statusCheckRollup --jq '[.[] \| select(any(.statusCheckRollup[]; .name == "check" and .conclusion == "SUCCESS")) \| .closingIssuesReferences[].number] \| unique \| length'` |
| Better / ends at | higher; 3 of 3 |
| The smoke issues | written by you after the build, outside the repo; the build agent never sees them |
| Each PR must also show, read by you in `/factory` | a plan comment with types, signatures, files and a seal; at least one call; its cost |
| Pane | you open `/factory` during the smoke run; its rows match `gh` |
| Must keep passing | `claude plugin test factory`, `tsc --noEmit`, `bun test`, the anti-slop Oxlint rules, hope and hunch tests |
| Cap | 3 smoke runs; then stop and report what failed |
| Dry run today | 0 of 3: nothing exists. Free checks read now: no `ANTHROPIC_API_KEY`; `gh` at 5,000/hour; `claude agents --json` and `wt` v0.80 answer |
| Fence: easy issues | each smoke issue needs a design choice: a new type and 2+ files |
| Fence: merging past checks | you can bypass the ruleset as admin, and the factory runs under your login, so the command counts only PRs whose `check` passed |
| Fence: faked cost | the cost line must match the run's transcript token count |
| Fence: narration | done means the command's own output in the transcript, never a claim |

**2. The factory works on real work (in meta-harness)**
| Part | Value |
|---|---|
| Observable | issues merged with zero code commits from you, out of 10 |
| Command | `gh pr list --label factory --state merged`, then each PR's commits by author |
| Better / ends at | higher; 8 of 10 |
| Also read | cost per merged PR; waits per day vs your cap; stuck runs |
| Ask hook, before the trial | agrees with your call on 18 of 20 choices from meta-harness's 200+ merged PRs |
| Must keep passing | the repo's required checks on every PR |
| Dry run today | meta-harness main requires `check`, `rules`, `review`, `critic` (ruleset `main-2`), so auto-merge is allowed there. `review` runs Claude (`claude-code-action`), so an AI judge already gates merges there. It is meta-harness's own rule, so the factory keeps it; the comment-only line covers the factory's own reviewer |
| Cap | 10 issues, or one week of your Max usage |
| Fence: easy picks | you label the 10 before the trial starts; the factory never adds or edits one |
| Fence: ask-hook set | you label the 20 choices; the hook never sees your labels while it is tuned |
| You alone | watch the first run use the plan and checks the contract names |

## Next
Commit this file. Create the throwaway smoke repo. Fly the build. Run the free unverified checks. Run the unverified checks. Then build all parts.
