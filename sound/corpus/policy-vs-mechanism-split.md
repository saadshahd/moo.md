---
paths: "**/*.{ts,tsx}"
when: always
source: Fowler
topic: placement
---
A mechanism computes and returns; a policy decides whether, what, and where a side effect happens. Policy must never hide inside a helper the caller can't see through — the deciding, not merely the effecting, is what has to be visible at the call site.
_Avoid_: any helper named `logX`, `notifyX`, `recordX`, `handleX` that itself decides to call `logger`, `fetch`, or a queue publish internally.
Detect: a function whose name is a verb implying a decision (`log`, `notify`, `record`, `save`, `alert`) but whose call site shows no logger, no client, no queue — the decision is one hop deeper than the reader can see.
Not-when: the "helper" is a pure formatter/transform with a noun-ish name (`formatResult`, `toLogLine`) that takes data and returns data — that's mechanism, and hiding it is fine; the smell is specifically the side-effecting verb.
Cross-ref: side-effects-visible-at-the-call-site — the visibility invariant this rule refines from effecting to deciding.
