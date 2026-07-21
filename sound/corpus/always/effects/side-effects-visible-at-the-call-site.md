Side effects live at the edges and are visible at the call site — no decorators, no implicit middleware, no silent mutations. If a function logs, that's a side effect and it belongs to the caller, not the function: pure business-logic functions NEVER call a logger internally.
_Avoid_: a logger, `fetch`, queue publish, or mutation buried inside a function whose name promises pure computation; effects reached through a decorator or middleware the call site can't see.
Detect: a `logger.`/`console.`/`fetch(`/network or storage call inside a function that returns a computed value and is named for that computation.
Not-when: the function IS the edge — an explicit IO/effect function whose name says so (`persist`, `emit`, `sendEmail`) — where the effect is its declared job.
Cross-ref: policy-vs-mechanism-split — the test is whether the function DECIDES that an effect happens; dependency-at-the-edges — who owns the impure capability itself.
