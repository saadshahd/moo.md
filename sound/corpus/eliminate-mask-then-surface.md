---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: effects
---
when: [always] · tier: standard · check: judgeable
This ladder governs in-process logic with enumerable failures. Apply in sequence; reach the next step only when the current one can't remove the error. (1) Define the error out of existence — redesign so the failure case doesn't exist (`unset` of a missing key is a no-op; an empty range returns `[]`, not a `RangeError`). (2) Mask it at the lowest layer that can recover — absorb the failure where it occurs and return a normal value, aggregating many would-be errors into one boundary check rather than threading a Result through every signature. A masked value must be a domain-sanctioned meaning of the absent case (an empty range genuinely IS `[]`), never a fabricated stand-in for a failure (a failed fetch returning `[]` is a lie that reports success); an unimplemented path stays loudly unimplemented, never a plausible default. (3) Only then surface it as data: return a `Result<T, E>` whose `E` names ONLY the failures the caller must branch on. No throw, no try/catch. At high-stakes tier, every surfacing failure mode is enumerated up front.
_Avoid_: a `Result` on every parse/db/validate call regardless of whether the caller can act; a masked value that fabricates success for a real failure — returning `[]`/`0`/`null` because a call failed, not because the domain says the case is empty.
Detect: a fallible function returning `Promise<T>` (not `Result`) that can throw; a `Result` whose `E` includes a failure the caller can't act on — it should have been eliminated (1) or masked (2); a `catch` or `?? default` that returns a plausible value for a genuine failure rather than a domain-defined absence.
Not-when: a failure that must escape and kill the enclosing unit rather than reach a caller — see error-handling-two-regimes.
Cross-ref: error-handling-two-regimes — what happens at the unit boundary when a failure is not enumerable; remote-call-has-a-third-outcome — the [distributed] carve where "unknown" cannot be defined out or masked.
