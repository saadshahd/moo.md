---
name: statechart
description: Model a flow that moves between states in TLA+, check the rules its reader agrees to with the everystate model checker over every order of events, and chart it in the reader's words with the shortest path to each rule that breaks. Use when a flow, protocol, retry loop or state machine needs its rules checked, a bug shown as a path through states, or formal verification is asked for.
---

The chart shows how a system moves between states, in the words of its reader: the person who decides whether the behavior is right.

## Pick the target

Pick the promise whose break harms users most and that tests rarely reach: the strongest one in the code, never the easiest to model. Read the code for it; ask the user only what the code cannot show.

Name the question before the tool:

| The question | The tool |
|---|---|
| Can events happen in a bad order? | A model checker: this skill |
| Does the code hold for every input? | A verifier that runs on the code; with none for its language, generated inputs on the real code |
| Does it hold at every size, past any bound? | A proof |

A question that is not about order → say which kind it is and stop; `sound:find` picks the tool.

## Write the model

Write `SPEC.tla` and `SPEC.cfg` in a scratch folder, or beside the code they cover when the project keeps them.

- Point each action at the code a reviewer can open, in a `\* path:line` comment. What the code does in one indivisible step is one action; two steps are two.
- Head the spec with the files and functions it covers and the commit it was last checked against, `\* covers:` and `\* synced:`, so a later change to them shows the model may be stale.
- Each rule the reader agrees to is an INVARIANT; one about "eventually" or "forever" is a PROPERTY. A rule with no variable to check it gets one. Never weaken a rule to make it hold.
- `Next` is a disjunction of named actions, `Pay \/ Decline`, so each step has a name.
- A correct end state still breaks deadlock: give it a step that changes nothing, `Done == phase \in {"paid", "failed"} /\ UNCHANGED vars`.
- Keep the constants small, or add a CONSTRAINT, so the check ends.

## Write the view

A module that exports:

- `state(vars)`: the reader's words for a state, such as "Paying" or "Lease held, write pending", never a variable name. A set arrives as an array; a sequence, record or function as an object keyed by its domain, so `v.pc[1]` is `pc[1]`.
- `step(action, from, to)`: the step as the reader sees it happen, such as "you press pay", or `null` to hide it. A step that happens only in some conditions ends with them in brackets, in the reader's words: `you press play [while the file loads]`. Two actions that end the same share a label, and so an arrow.
- `title`.

Aim for about 20 arrows. First give one label to states that act the same; never one label to states that break different rules. Then hide steps the reader does not need, such as a reset every state has. Hiding keeps every state reachable from a start, one arrow out of each state that has a step out, and all of an arrow or none.

## Run

```sh
bun ${CLAUDE_SKILL_DIR}/scripts/statechart.ts SPEC.tla --view view.ts --out <folder>
```

It runs everystate, a TLC-compatible model checker, through `bunx`, so it needs only bun.

It checks each rule in its own run, so one break hides no other rule's verdict, and gives the shortest path to each rule that breaks. It sets the config's ALIAS aside, because the chart shows the model's own variables. It refuses a spec or config everystate cannot read, and a view that would make the chart claim what the model does not do; the message says what to change. Above 500 states it draws only the paths to broken rules. It exits 0 when every rule holds, 1 when one breaks, 2 when it refuses.

## Prove it can fail

Before trusting a pass, break the promise in the real code on a scratch change, such as a removed guard or two steps swapped. Update the model as the code now reads and rerun: a rule must break. Drop the change and rerun: the verdicts are back where they started. A check never seen failing proves nothing.

## When the covered code moved

Diff the covered files from the sync commit, and read each commit message. Sort each change:

- It touches nothing the model describes.
- The model no longer describes the code → update the model from the code, before rerunning.
- The promise changed on purpose → change the rule, citing the evidence: a doc comment, a test, the changelog or the commit message.
- Nothing says the promise changed → a break that follows is a bug candidate.

Rerun, then give each check one outcome: in sync, updated, bug, or blocked and why. Move the sync commit only once the model describes the code at the new commit.

## Hand off

Show `chart.mmd` where Mermaid draws: a Pad, a doc, a pull request. Then one line per bug: the rule, the reader's sentence for it, and its path as `report.md` numbers it. Say what the model leaves out and which steps the chart hides, and give the command that makes the files again.

When the model describes code, replay each bug path against the real code, one step per action, as a test or a live repro. A path that does not replay means the model is wrong until shown otherwise.
