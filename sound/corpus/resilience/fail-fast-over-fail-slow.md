If a dependency is degraded such that success is unlikely, reject immediately — don't queue the caller behind a doomed retry-with-backoff that ties up capacity.
_Avoid_: unbounded or long-backoff retry loops wrapping a single external call with no breaker/budget check first; retry count or delay that scales past ~1s total caller-blocking time.
Detect: a loop that retries a single external call with increasing sleeps and no upper bound on total elapsed time before returning to the caller.
Not-when: idempotent background jobs off the request path where slow-eventual-success is the actual contract (a queue consumer, a batch reconciler).
Cross-ref: restart-policy-as-data.md — same anti-pattern (hand-rolled retry loop), opposite regime: on the request path, breaker-reject fast (this rule); for supervised background work, retry belongs in declarative supervisor config (restart-policy-as-data).
