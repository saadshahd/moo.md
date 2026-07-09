---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
This ladder governs in-process logic with enumerable failures. Apply in sequence; reach the next step only when the current one can't remove the error. (1) Define the error out of existence — redesign so the failure case doesn't exist (`unset` of a missing key is a no-op; an empty range returns `[]`, not a `RangeError`). (2) Mask it at the lowest layer that can recover — absorb the failure where it occurs and return a normal value, aggregating many would-be errors into one boundary check rather than threading a Result through every signature. (3) Only then surface it as data: return a `Result<T, E>` whose `E` names ONLY the failures the caller must branch on. No throw, no try/catch. At high-stakes tier, every surfacing failure mode is enumerated up front.
WRONG:
```ts
// reflex: every fallible call returns a Result, threaded through every layer
async function parse(raw: string): Promise<Result<Order, ParseError>>
async function load(id: string): Promise<Result<Order, ParseError | DbError>>
// hidden: throws, so the failure never appears in the signature
async function getUser(id: string): Promise<User>
```
RIGHT:
```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }; // find or define ONCE
// caller must branch on NotFound and DbError, so they surface; the
// connection-retry failure beneath is masked in the data layer and never appears here
async function getUser(id: string): Promise<Result<User, NotFound | DbError>>
```
_Avoid_: a `Result` on every parse/db/validate call regardless of whether the caller can act; an `E` arm listing a failure no caller branches on; a signature that throws instead of surfacing.
Detect: a fallible function returning `Promise<T>` (not `Result`) that can throw; a `Result` whose `E` includes a failure the caller can't act on — it should have been eliminated (1) or masked (2).
Not-when: a failure that must escape and kill the enclosing unit rather than reach a caller — see error-handling-two-regimes.
Cross-ref: error-handling-two-regimes — what happens at the unit boundary when a failure is not enumerable; remote-call-has-a-third-outcome — the [distributed] carve where "unknown" cannot be defined out or masked.
