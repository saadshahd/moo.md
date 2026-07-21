---
paths: "**/*.{ts,tsx}"
when: distributed
source: Armstrong
topic: consistency
---
Concurrent workers/handlers communicate only by passing immutable job payloads or published facts — never by reading or writing a shared in-process object, cache, or module-level variable.
_Avoid_: `let`/module-level mutable counters, caches, or maps read and written by more than one concurrently-running handler.
Detect: a variable declared outside any single job's function scope that is mutated by handler code running concurrently for different jobs.
Not-when: the "shared" value is a read-only, immutably-replaced config loaded once at startup (composition root) — dependency-at-the-edges already covers that case.
