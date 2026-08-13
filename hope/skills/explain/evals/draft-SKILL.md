---
name: explain
description: Put one settled thing in the user's head, plainly
when_to_use: the user does not hold something already settled
---

Turn something settled the user doesn't hold into that thing, usable, in the user's head.

## Needs

Something settled — a design, a term, a behavior, a number — that the user has said or shown they don't hold.

## Gives

The thing, usable, in the user's head: they can say it back in their own words or act on it.

## Turns

`open`
- **Advances:** the user probes — "tell me more", "I still don't get X", a follow-up question.
- **Retires:** the user says it back, acts on it, or moves the work on.

## Wrong move if

The agent is the one learning → **Elicit**.
The user wants a verdict on it, not an understanding of it → not this move.

## Prompt

```md
Thing: <the settled thing the user doesn't hold>

First check the thing is settled and the user doesn't hold it. If
either fails — not settled, already held, or the thing isn't in front
of you — say which in one plain line and stop. Never explain anyway.

State it in one plain line — no jargon, no preamble, no build-up.
Stop there. Name the two or three directions the user could pull next.

Answer each pull the same way: one plain line first, depth only where
pulled. Never push the full picture unpulled.

It has landed when the user can say it back in their own words or
moves on. If they say they still don't get it, the line was wrong —
find a different plain line, don't add more words to the old one.
```
