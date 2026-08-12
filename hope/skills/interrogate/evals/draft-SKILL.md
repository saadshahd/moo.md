---
name: interrogate
description: Make the user defend a proposal they committed to
when_to_use: a proposal is committed but its decisions are undefended
---

Turn a proposal the user already committed to into decisions the user can defend.

## Needs

A proposal the user has already committed to — locked, chosen, or declared — whose inner decisions haven't been defended.

## Gives

Decisions the user can defend: each surfaced decision carries a defence or an amendment the user said themselves.

## Turns

`open`
- **Advances:** each answer — it stands as a defence, becomes an amendment, or exposes the next undefended decision.
- **Retires:** every surfaced decision has a defence or amendment in the user's own words.

## Wrong move if

It could finish with the user absent → not a move; run a review or audit instead.
The user hasn't committed yet → **Elicit** — there's nothing to defend.

## Prompt

```md
Proposal: <the committed proposal>

Find the decisions inside it the user has not defended. Ask about one
at a time: what breaks if this is wrong, what it traded away, why this
over the nearest alternative.

Only ask what the user alone can answer. Anything answerable from the
repo or the record, answer yourself and move on — if nothing needs the
user, this is a review, not this move.

After each answer: keep it as the defence, record it as an amendment,
or follow it to the next undefended decision.

Retire when every surfaced decision has a defence or amendment the
user said themselves.
```
