---
name: widen
description: Broaden a rule past its cases, still sound on them
when_to_use: a rule decides only the cases it came from
---

Turn a rule that decides only the cases it came from into the broadest rule still sound on them.

## Needs

Cases, and a rule (stated or implied) that decides only those cases.

## Gives

The broadest rule still sound on every case — with the record of what it now decides and where it stopped.

## Turns

`finite: 1` — cases in; one turn out with the rule and its probe record. The widen-then-narrow loop runs inside the turn.

## Wrong move if

Nothing unseen will ever meet the rule → **Compress**.
The grounds moved — new cases, new objective — → new derivation, not a refit.

## Prompt

```md
Cases: <...>

Do not summarize these. Induce the widest rule that
(a) gets every case above exactly right, and
(b) forbids the wrong answer in each.

Then:

1. List 10 situations NOT in my cases where this rule gives a definite answer, and state the answer it forces in each.
2. Find one situation where it forces a WRONG answer. If you find one, narrow the rule by the smallest amount that fixes it, and repeat.

Prefer the rule that decides more situations, even if it takes longer to state.
```
