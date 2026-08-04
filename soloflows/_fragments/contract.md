Substitute `<slug>` and `<scope>`; send it as the lane's first turn, at spawn. Nothing else
is sent to a lane, ever.

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

Every clause is load-bearing and none is decoration:

- **A pointer, not an inlined scope.** A lane that never re-reads a pointer cannot start —
  loud. One that never re-reads an inlined brief works happily against a superseded seam —
  silent, and surfaces at merge.
- **The cost-asymmetry sentence is the mechanism**, not encouragement. A bare permission line
  states the permission but not which error is worse, leaving the model's own finish-the-task
  bias to decide — and that bias runs toward not stopping.
- **"Do not close this process"** is what keeps a finished lane readable. Nothing else produces
  its absence, so a lane that closes itself vanishes before it has been read.
