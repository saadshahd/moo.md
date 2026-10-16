---
name: harvest
description: Report where a session missed moo's standard — the agent asks only while stating intent and shape, then works on its own — as issues a builder can act on. Pass a session id to report on a past session instead of this one.
disable-model-invocation: true
---

harvest captures and reports. It never drafts, builds or fixes a skill: builders do that from the report.

## Read

Run `${CLAUDE_SKILL_DIR}/scripts/read.sh <id>`, where `<id>` is `$ARGUMENTS` if given, else `${CLAUDE_SESSION_ID}`. It fails → show its error and stop.

Its output is the only source. A turn you cite is a numbered turn in it. It cuts long agent text; `read.sh <id> <turn>` prints one turn whole.

## Detect

Read every file in `${CLAUDE_SKILL_DIR}/kinds/`. Each names one way a session misses the standard: its sign in the marked turns, what counts, what doesn't, the evidence it needs. Walk the turns once per kind and collect each flow that meets it with the evidence it asks for. A flow without that evidence is dropped, not guessed at — but first read whole every cut turn it cites.

## Name the opportunity

For each flow, one of the rows below. A skill covers the need when its description fits the turns; it says the move when a line of its `SKILL.md`, at the path `read.sh` prints, asks for what the turn skipped.

| The flow shows | Opportunity |
|---|---|
| A `[skill]` line for a skill that covers the need and says the move | A line the agent had and lost, quoted. Rewording it is not the fix |
| No `[skill]` line for the skill that covers the need, or another skill ran in its place | Selection: the skill, and the turn's words that should have loaded it |
| A `[skill]` line for a skill that covers the need, silent or vague on the move | Improve that skill, named |
| No installed moo skill covers it | A new skill |
| Steps the user gave more than once | A reusable piece |

State the need — what must happen, and when — never the unit that would carry it. Check the installed list `read.sh` prints before calling anything new: a need an installed skill covers takes one of the first three rows. A line quoted from a plugin `read.sh` marks as updated after the session began may not be the text that ran: say so.

## Value

Name which of moo's four outcomes the fix serves: reduce decision regret, increase conceptual clarity, fewer but stronger artifacts, preserve the capacity to own what you produce. None → drop the flow.

## Match past issues

Run `${CLAUDE_SKILL_DIR}/scripts/past.sh`. It fails → show its error and stop: filing needs the same access.

It lists every harvest issue, open or closed, with what its comments say about reopening it. A flow whose need a listed issue already states, in any words, is a new case for that issue, never a new issue. Read the issue whole (`gh issue view <N> -R saadshahd/moo.md --comments`) before calling the match.

## Draft

Each into its own file from `mktemp`: one issue per new flow, laid out as `${CLAUDE_SKILL_DIR}/issue.md`; one comment per matched flow, laid out as `${CLAUDE_SKILL_DIR}/comment.md`. Quote the user only from `read.sh` turns. Put a placeholder where a repo, file, service, person or remote would go.

## Scrub

Run `${CLAUDE_SKILL_DIR}/scripts/scrub.sh <id> <draft>` on each draft. Exit 1 → replace each term it lists with a placeholder and run it again. Never show a draft that has not passed.

## Show

Every flow, ranked by the weight of its evidence: most turns cited and clearest sign first. For each, the draft in full and its file path; for a comment, also the issue it joins and whether it reopens it. Then ask the reporter which to file.

## File on yes

Only the drafts the reporter says yes to, as shown:

- An issue: `tail -n +2 <draft> | gh issue create -R saadshahd/moo.md --label harvest --title "$(sed -n '1s/^Title: //p' <draft>)" --body-file -`. The draft's first line is its title, so the body starts after it.
- A comment: `gh issue comment <N> -R saadshahd/moo.md --body-file <draft>`, then `gh issue reopen <N> -R saadshahd/moo.md` when its Reopen section says the case meets the issue's condition.

Show each URL. A draft changed after the yes goes back through Scrub and Show.

Never:

- Propose a new unit where an installed one covers the need.
- File a new issue for a need a past issue already states.
- Write code or unit files.
- File without the reporter's yes to the exact text.
