---
name: freeze
description: Freeze outside-the-repo state into one snapshot. Use when the work depends on the current state of a service, database, queue, third party, or live logs.
---

## Observe

Build the snapshot, invoking each named skill with the Skill tool where its condition holds:

- Which outside facts this work touches reads two ways, and the two would build different snapshots → use **clarify** skill. Scope to the slice the work touches, not a general map.
- Name the facts the work depends on. Naming which facts matter is the only place reasoning fills in; each fact's value comes from reading it.
- Read each named fact live, read-only — look, don't touch: no write, no state-changing call, no toggle. A fact unreachable, or one that reading would change → an open gap, with instructions for the human to retrieve it by hand.
- Use **draft** skill on the snapshot: the observed facts and the open gaps, kept apart — each observed fact carrying what it says, where it lives, and when it was read; anything concluded over the facts marked as a conclusion and kept out of the observed set.
- The snapshot → use **judge** skill, on the claim: every named fact is observed or an explicit open gap, and no value was invented. An invented value demotes to a gap or gets re-observed.

A hand-retrieved fact, a re-observation, or an amendment re-enters the snapshot, and the snapshot gets judged again. A fact's value is observed or it is a gap; there is no third kind.

## The snapshot

One snapshot, in conversation, stateless: re-run the whole freezing to refresh it. Hand it back as two lists of short bullets — each observed fact on one line with where it lives and when it was read, each gap on one line named as a gap.

It stands when judge's verdict stands and the user locks it, or when the user stops with gaps standing. A snapshot with named open gaps is a valid lock; the gaps are what is open.

Every needed fact lives in the repo → read them where the work runs; no snapshot. The outside system is to be changed, not read → that is the work itself, not its grounding; proceed with the work.
