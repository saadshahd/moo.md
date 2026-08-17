---
name: freeze
description: Freeze outside-the-repo state into one snapshot. Use when the work depends on the current state of a service, database, queue, third party, or live logs.
---

## Extract

From the conversation/context/user:

- The **work** on the table, and the **slice** of outside state it depends on — which service, database, queue, third-party, or live-log facts it touches.

## Gate

Proceed only when: the work depends on the current state of something outside the repo.

Anything else, say which in one plain line — never snapshot anyway:

- Every needed fact lives in the repo → read them where the work runs; no snapshot.
- The outside system is to be changed, not read → that is the work itself, not its grounding; proceed with the work.

## Observe

Build the snapshot, invoking each named skill with the Skill tool where its condition holds:

- The slice reads two ways — which outside facts this work touches would build different snapshots → use **clarify** skill. Scope to the slice the work touches, never a general map.
- Name the facts the work depends on. Naming which facts matter is the only place reasoning fills in — a fact's value never comes from reasoning.
- Read each named fact live, read-only — look, never touch: no write, no state-changing call, no toggle. A fact unreachable, or one that reading would change → an open gap, with instructions for the human to retrieve it by hand.
- Use **draft** skill on the snapshot: the observed facts and the open gaps, kept apart — each observed fact carrying what it says, where it lives, and when it was read; anything concluded over the facts marked as a conclusion, never mixed into the observed set.
- The snapshot → use **judge** skill, on the claim: every named fact is observed or an explicit open gap, and no value was invented. An invented value demotes to a gap or gets re-observed.

A hand-retrieved fact, a re-observation, or an amendment re-enters the snapshot, and the snapshot gets judged again. A fact's value is observed or it is a gap; there is no third kind.

## Output

The snapshot is the result — one snapshot, in conversation, stateless: re-run the whole freezing to refresh it. It stands when judge's verdict stands and the user locks it, or when the user stops with gaps standing — a snapshot with named open gaps is a valid lock; its gaps are named as gaps, never claimed as observed.

Then return to the work the snapshot grounds. The freezing is spent once the snapshot stands — anything further re-enters as a re-observation or amendment, never as a second snapshot beside the first.
