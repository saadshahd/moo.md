---
paths: "**/*.{ts,tsx}"
when: always
source: Bloch
---
when: [always] · tier: standard · check: judgeable
A function's signature must carry every fact a caller needs to use it correctly — not just a name that reads well, but preconditions, ordering constraints, every error mode, and any performance cliff a caller could hit by surprise.
WRONG:
```ts
// name reads fine, but signature hides the contract
declare const charge: (amount: number) => Promise<Receipt>
// caller must intuit: currency? idempotency? what if card declined vs network down?
```
RIGHT:
```ts
type ChargeOutcome =
  | { status: 'ok'; receipt: Receipt }
  | { status: 'declined' }
  | { status: 'unknown'; ref: IdempotencyKey }  // network call: "may have applied" is part of the contract
declare const charge: (input: { amountCents: number; currency: Currency; idempotencyKey: IdempotencyKey }) => Promise<ChargeOutcome>
```
_Avoid_: bare `number`/`string` params standing in for units, currencies, or IDs that carry caller obligations; error modes documented only in a comment or README instead of the return type.
Detect: a public function whose parameter or return type could be satisfied by a caller who hasn't read the implementation, but who would still misuse it — ambiguous units, missing idempotency signal, error cases absent from the type.
Not-when: private helpers with a single, already-informed call site inside the same module — the contract there is enforced by proximity, not by the type.
Cross-ref: remote-call-has-a-third-outcome — the `unknown` arm a process-boundary contract must carry.
