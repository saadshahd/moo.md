---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: effects
---
when: [always] · tier: standard · check: judgeable
Give a sub-flow its own reducer addressed only by typed messages ONLY when its lifecycle is independent of the parent — it runs as concurrent instances, survives a parent transition, or self-resets. When it earns that, the parent only SENDS messages and READS a published view; it NEVER reaches into the child's internals. A mode the parent merely steps through over shared data stays nested state.
WRONG:
```ts
// a wizard the parent walks through, over shared data, dressed up as an actor
childActor.send({ type: 'NEXT_STEP' });
parent.wizardStep = childActor.getState().step;   // parent mutating child internals
```
RIGHT:
```ts
// lifecycle bound to the parent → just nested state
type Wizard = { step: 'details' } | { step: 'review' } | { step: 'done' };
// reserve the message-addressed reducer for a child that outlives or runs concurrently with the parent
```
_Avoid_: a reducer/message protocol wrapping a linear mode the parent owns end-to-end; a parent that both sends messages to a child and reads or writes the child's internal fields.
Detect: an actor-ish sub-reducer whose lifecycle is entirely contained by one parent transition — ask whether it runs concurrently, survives the parent, or self-resets; if none hold, it's nested state, not an actor.
Not-when: the sub-flow genuinely has an independent lifecycle (concurrent instances, outlives the parent, self-resets) — then the isolated reducer with a message boundary is correct.
