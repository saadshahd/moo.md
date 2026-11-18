---
name: statechart
description: Model a flow that moves between states in TLA+, check the rules its reader agrees to in TLC over every order of events, and chart it in the reader's words with the shortest path to each rule that breaks. Use when a flow, protocol, retry loop or state machine needs its rules checked, or a bug shown as a path through states.
---

The chart shows how a system moves between states, in the words of its reader: the person who decides whether the behavior is right.

## Write the model

Write `SPEC.tla` and `SPEC.cfg` in a scratch folder.

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
TLA2TOOLS=<tla2tools.jar> JAVA=<java> bun ${CLAUDE_SKILL_DIR}/scripts/statechart.ts SPEC.tla --view view.ts --out <folder>
```

It needs Java 11 or later and `tla2tools.jar`: `brew install openjdk`, then `gh release download v1.7.4 -R tlaplus/tlaplus -p tla2tools.jar`.

It checks each rule in its own run, so one break hides no other rule's verdict, and gives the shortest path to each rule that breaks. It refuses a spec SANY cannot read, a config TLC refuses, and a view that would make the chart claim what the model does not do; the message says what to change. Above 500 states it draws only the paths to broken rules. It exits 0 when every rule holds, 1 when one breaks, 2 when it refuses.

## Hand off

Show `chart.mmd` where Mermaid draws: a Pad, a doc, a pull request. Then one line per bug: the rule, the reader's sentence for it, and its path as `report.md` numbers it. Say what the model leaves out and which steps the chart hides, and give the command that makes the files again.

When the model describes code, replay each bug path against the real code, one step per action, as a test or a live repro. A path that does not replay means the model is wrong until shown otherwise.
