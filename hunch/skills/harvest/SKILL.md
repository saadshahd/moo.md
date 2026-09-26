---
name: harvest
description: Draft skills from the one procedure a session kept walking the agent through, split into reusable moves, each scored against no skill. Pass a session id to mine a past session instead of this one.
disable-model-invocation: true
---

## Read the session

The transcript is `~/.claude/projects/*/<id>.jsonl`, where `<id>` is `$ARGUMENTS` if given, else `${CLAUDE_SESSION_ID}`. No file matches → say which id failed and stop.

The user's turns are the `type == "user"` lines whose `message.content` is a string not opening with `<`. The assistant turns around them show what the user accepted.

## Name the procedure

A procedure is steps the user gave the agent that they would give again in another session: an order, a check, a place to look, a thing to never do. Name it in the user's words. None → say what came closest and why it fails, and stop.

## Split it

List its steps in the user's words and order, and sort each one:

| The step | Becomes |
|---|---|
| An installed skill already does it | A call to that skill by name |
| No turn in the session shows it | A line in the composer |
| Anything else | A move: its own skill and eval case |

## Draft

1. `claude plugin init <procedure> --description "<one line>"` writes `~/.claude/skills/<procedure>/`. The name is taken → pick another; never `--force`.
2. Delete the root `SKILL.md` and the `skills` key in `.claude-plugin/plugin.json`; with them, `plugin details` counts no skill and `evals/` loads as plugin parts.
3. Write each move as `skills/<move>/SKILL.md`: its step as the user gave it, under a one-line `description` of the situation it fits.
4. Write the composer as `skills/<procedure>/SKILL.md`: the steps in order, each a call by name or a line.
5. Write one eval case per move, and one for the composer from the turn that started the procedure, under `evals/<case>/`:
   - `prompt.md`: the turn as the user typed it, with `max_turns` and the `allowed_tools` it needs in its frontmatter.
   - `graders/accepted.md`: `type: llm`, and the outcome the transcript shows the user accepted.

## Score

1. `claude plugin eval <procedure> --trust-plugin --no-publish --json <draft>/evals/result.json`, with `--allow-tools` naming every gated tool (Bash, Write, Edit, WebFetch, `mcp__*`) a case lists. It runs each case with the draft and without it.
2. A move that scores the same without the draft → fold it into the composer as a line; delete the move and its case.
3. `claude plugin details <procedure>@skills-dir` gives the token cost.

A command fails → show its error and stop. Never hand back an unscored draft as scored.

## Hand back

A row per move and for the composer: path, score with and without, difference. Then what folded into lines and why, what each case needed that the eval could not see, and the always-on token cost. End with: keep it, or `rm -rf ~/.claude/skills/<procedure>`.

Never:

- Install a draft into moo.
- Draft a second procedure in the same run.
- Write an eval case, or a file it needs, that the session does not contain.
