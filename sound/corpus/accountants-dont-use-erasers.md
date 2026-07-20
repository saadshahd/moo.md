---
paths: "**/*.{ts,tsx}"
when: distributed
source: Helland
topic: messaging
---
when: [distributed] · tier: high-stakes · check: deterministic
A recorded fact — a ledger line, an audit event, anything another party has already observed — is never edited or deleted in place; a correction is a new, appended reversing fact that references the original.
WRONG:
```ts
await Ledger.update(entryId, { amount: correctedAmount })  // erasing history
await Events.delete(badEventId)                            // it already happened
```
RIGHT:
```ts
await Ledger.append({ type: 'Reversal', reverses: entryId, amount: -original.amount })
await Ledger.append({ type: 'Posting', amount: correctedAmount, corrects: entryId })
// original stays; the sum is right; the trail shows what happened and why
```
_Avoid_: `UPDATE`/`DELETE`/`.update(`/`.delete(` against a ledger, journal, audit, event, or any append-only fact table; overwriting a field on an already-emitted fact.
Detect: a mutation or deletion targeting a table/collection whose name denotes recorded facts (ledger, journal, entries, events, audit, postings); a "fix the bad row" edit instead of an appended reversing entry.
Not-when: the row is inside-data still in its authoring transaction and never observed elsewhere (a draft not yet posted), or it's a hard privacy/GDPR erasure obligation — which is its own explicit, logged operation, not a casual overwrite.
