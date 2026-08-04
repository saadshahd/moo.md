---
name: run
description: Fan one goal across concurrent Solo lanes. You rule on the seams; each lane is spawned carrying them and a contract to stop when the work leaves what you agreed. Run it with /soloflows:run <goal>.
disable-model-invocation: true
---

The human rules on the seams. Each lane is spawned carrying them and one contract: **stop and ask
when the work leaves what was agreed.**

The bet is that this contract only works if it arrives at spawn — that a running lane handed it
later reads it as prompt injection and refuses. **That is a bet, not a property.** What was
measured is one lane refusing a *different* contract (self-close, since deleted) and one lane
obeying it at spawn: n=1 each, on text that no longer ships. The stop-and-ask contract has never
been retrofit-tested. If it turns out a running lane accepts it, this plugin has no reason to
exist — so read that as the first thing to disconfirm, not as its foundation.

Hand-spawned lanes, carrying no such contract, run past their scope instead — measured at 43% of
runs that could have been split, silently, surfacing at merge.

**The bar for everything below is the number of rulings the human makes.** A step that catches more
at the cost of more rulings is the wrong step. `soloflows/PROOF.md` owns the threshold; do not
restate it here.

## 1. Scopes and couplings, from disk

Read the goal, then the repo. Propose candidate **scopes** — groups of files the goal touches — and
compute what couples them.

A coupling is **verifiable** when two scopes write one file, import across, or share a declared
type. Compute those against disk. A coupling is **behavioural** when the dependency is real but has
no shared artifact: one scope's output shape is another's assumption, an ordering, a protocol.

**If the goal yields one top-level group, say so and end.** Do not invent a second lane to justify
having been invoked. Most goals land here.

## 2. Show the surface

One surface, once. It carries:

- the candidate scopes, with a **model** column — `--model` is settable only at spawn
- every **verifiable** coupling, **displayed and not asked**
- every **behavioural** coupling, as a ruling: *is this a seam?*

Rulings are reserved for behavioural couplings. Asking about a coupling you computed spends a turn
to confirm what disk already said.

**Never ask the human to approve the scopes.** They are editable and never gated; correcting one costs
nothing and is not a decision. The approval surface is seams alone.

**Ruling a coupling *not* a seam must be able to merge two candidate scopes into one lane.** If
derived lanes always come out equal to the proposed scopes, the scopes were the real proposal and
this step is theatre — check it every run.

Known and accepted: the computed set is exhaustive over the scopes *you* guessed. A file in no
candidate scope produces no coupling and appears nowhere. A merge conflict from an unenumerated
file is a known price, not a surprise.

## 3. Write the record

Derive lanes from the ruled seams. Pick a short `<slug>` for the run.

One Solo scratchpad, `name` and `tags` both `<slug>`. Sections:

- `seams` — what was ruled, and what crosses lanes
- one per lane, headed `<slug>:<scope>` — that lane's scope and the seams it owns

The record is the **only** inbound channel a running lane has. `send_input` is never called, and a
contract cannot be retrofitted, so anything that must reach a working lane reaches it here or not
at all. Keep it off the repo working tree.

## 4. Spawn each lane

One `spawn_agent` call per lane. No second call, ever.

- `name`: `<slug>:<scope>` — the lane's name is the whole view the human gets; the tree renders an
  unnamed agent as `Claude`
- `extra_args`: `--model <tier>`, and the contract below as the lane's first turn
- one call carries all of it; the brief lands as turn one and identity survives

Then stop. **Print nothing** — no roster, no summary, no count. Every fact such a message would
carry is already on the tree, and the human chose the slug in step 3.

### The contract, verbatim

Substitute `<slug>` and `<scope>`. Nothing else is ever sent to a lane.

```markdown
You are lane `<slug>:<scope>`, one of several working the same goal in parallel.

**The record** is Solo scratchpad `<slug>` (`solo scratchpads read --mode section`).
Read section `<slug>:<scope>` — your scope and the seams you own — and the `seams`
section. Read nothing else in it: other lanes' sections are not yours.
Re-read both before every commit; they change while you work.

**Stop and ask, here in this pane, before you act** when either is true:

- your work needs to touch anything outside your scope, or would change a seam —
  an interface, a shared contract. Interiors are yours; nothing else is.
- you cannot close a question from what you have. A stop you did not need costs one
  keystroke; a guess you should not have made costs this lane.

When the answer changes a seam, append it to the `seams` section with the revision you
read. If the write is rejected as a revision mismatch, another lane amended first:
re-read, re-decide, write again.

Do not close this process. It is closed from outside, once your work has been read.
```

Why each clause is worded as it is. None of these is verified to work — they are reasoned choices
about which failure is worse, and every one of them is a model's judgment with a rate nobody has
measured:

- **A pointer, not an inlined scope.** A lane that never re-reads a pointer cannot start —
  loud. One that never re-reads an inlined brief works happily against a superseded seam —
  silent, and surfaces at merge. Chosen for the loud failure.
- **The cost-asymmetry sentence, not a bare permission.** A permission line states the permission
  but not which error is worse, leaving the model's own finish-the-task bias to decide — and that
  bias runs toward not stopping. Whether naming the asymmetry actually moves it is untested.
- **"Do not close this process"** is what keeps a finished lane readable: nothing else produces
  its absence, so a lane that closes itself vanishes before it has been read. A lane that ignores
  the line takes its own output with it, and nothing will report that it did.

## What the human does next, and it is not yours

Watch the tree. `⌘N` into a lane that has gone static, answer it or read it, close it by hand.

`spinning` means working. `static` means **either** wants you **or** finished — the two are not
distinguishable, by construction. Nothing in this skill says so at runtime; a surface carries no
self-rationale.
