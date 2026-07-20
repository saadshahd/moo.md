---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: naming
---
when: [always] · tier: standard · check: deterministic
Actions that recompute derived state do NOT share the `set*` prefix with direct writes. Name them by the computation — `computeTotals`, `deriveLineups` — never `setComputedTotals`. `set*` means a caller-supplied write; recomputation is a different act.
WRONG:
```ts
function setComputedTotals() { state.totals = sum(state.lines); }
```
RIGHT:
```ts
function computeTotals(lines: Line[]): Totals { return sum(lines); }
// named by the computation; the caller applies the result
```
Detect: a `set*` function that takes no value argument (or ignores it) and instead reads other state to compute what it writes — the `set` prefix is lying about a recomputation.
Not-when: the function genuinely stores a caller-supplied value (`setName(name)`) — then `set*` is correct.
