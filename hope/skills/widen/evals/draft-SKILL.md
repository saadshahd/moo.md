---
name: widen
description: Assemble cases from context, induce the widest sound rule
when_to_use: a real case shows a class no rule yet decides, or a rule decides only the cases it came from
---

Turn a context holding real cases into the broadest rule still sound on every case assembled from it.

## Needs

A context holding real cases — the input, named files, memory — never a handed case list. If a rule already exists (stated or implied), it comes from the same context.

## Gives

The assembled case set, and the broadest rule still sound on every case in it — with the record of what it now decides and where it stopped.

## Turns

`finite: 1` — context in; one turn out with the case set, the rule, and its probe record. Assembly, induction, and the widen-then-narrow loop all run inside the turn.

## Wrong move if

Nothing unseen will ever meet the rule → **Compress**.
The grounds moved — new cases, new objective — → new derivation, not a refit.

## Prompt

```md
Context: <where the real cases live — the input, the named files, memory>

First check the context holds real cases and something unseen will
meet the rule. If either fails — no case to find, or a closed set
wanting its shortest statement — say which in one plain line and stop.
Never induce anyway.

Then assemble the case set. Pull every real case the context holds —
what the input shows, what the named files record, what memory and
your own judgment place in the same class. State each case with the
wrong answer it exhibits and the right answer it demands. Do not ask
for cases; finding them is this move's first act.

Do not summarize the cases. Induce the widest rule that
(a) gets every case in the set exactly right, and
(b) forbids the wrong answer in each.

Then:

1. List 10 situations NOT in the case set where this rule gives a definite answer, and state the answer it forces in each.
2. Find one situation where it forces a WRONG answer. If you find one, narrow the rule by the smallest amount that fixes it, and repeat.

Prefer the rule that decides more situations, even if it takes longer to state.
```
