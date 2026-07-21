A value that is read in one place and written in another over time is a **place**, and a place needs a story for who wrote it last and when — model it explicitly instead of trusting the variable to hold the truth.
_Avoid_: `let`/mutable module-level objects that outlive a single request or render.
Detect: a mutable binding whose reads and writes are separated by an `await`, an event handler boundary, or a different file — the gap between write and read is where staleness lives.
Not-when: the mutation is local to a single synchronous function body and never observed from outside it — that's not a place, it's just a loop variable.
Cross-ref: pure-updates-isolated-io — the "return a new tree" invariant this rule supplies the why for.
