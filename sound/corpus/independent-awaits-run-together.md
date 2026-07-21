---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: effects
---
Awaiting independent async operations one at a time in a loop pays their latencies in series for no reason — N round-trips become N sequential waits, and one rejection abandons the rest mid-flight. When an iteration's await does not depend on a previous iteration's result, run them together with `Promise.all` (or `allSettled` when partial success is the model).
_Avoid_: `await` inside a plain `for`/`for...of`/`while` whose iterations don't feed each other; building a result array by pushing each awaited value in sequence when the source items are already in hand.
Detect: a loop body containing `await` where the awaited call takes only the current item (no data dependency on a prior iteration) and no ordering side effect requires serialization — it collapses to `Promise.all(items.map(...))`. A `for await` over an async iterator is legitimate streaming, not this.
Not-when: each step genuinely depends on the previous one's result (a true sequential pipeline), or the operations must be serialized to respect ordering, a rate limit, or a transactional boundary — then the serial await is correct.
Cross-ref: per-unit-crash-isolation — the [distributed] sibling about fault isolation across concurrent units (this rule is about wasted latency; that one is about one failure not aborting the batch); order-by-logical-sequence-not-wallclock — when order is the real constraint.
