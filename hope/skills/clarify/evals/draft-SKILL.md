---
name: clarify
description: Turn words with two readings into one confirmed ask
when_to_use: the user's words admit two readings that would build different things
---

Turn words that admit two readings into one confirmed ask.

## Needs

Words already on the table that admit two (or more) readings — and the readings lead to different work.

## Gives

One confirmed ask, restated and accepted.

## Turns

`finite: 1` — one exchange: readings out, pick back, ask restated.

## Wrong move if

It keeps going past concrete → **Interrogate**.
The user can't pick because they can't say what they hold → **Elicit**.
The readings all lead to the same work → no move; just proceed.

## Prompt

```md
Words: <the ask as given>
Readings: <reading A> / <reading B>

Name the readings apart — one line each, ending in what each would
build or do differently. Ask the user to pick.

Take the pick as the confirmed ask. Restate it in one line and proceed.

One exchange. Do not ask a second question. If the user cannot pick,
the words are not the problem — stop clarifying.
```
