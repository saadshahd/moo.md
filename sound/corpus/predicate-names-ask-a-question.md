---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: naming
---
when: [always] · tier: standard · check: deterministic
Boolean-returning names answer a yes/no question: `is*` / `was*` / `should*` / `does*`. Now-vs-then pairs differ by tense only — `isX` is current state, `wasX` is prior state. Ban `validate` and `check` as predicate names; they hide the question the boolean answers.
WRONG:
```ts
function validate(order: Order): boolean {}
function checkEmail(email: string): boolean {}
```
RIGHT:
```ts
function isEligible(order: Order): boolean {}
function isValidEmail(email: string): boolean {}
```
Detect: a function whose return type is `boolean` and whose name does not start with `is`/`was`/`should`/`does`/`has`; `validate`/`check` returning a boolean.
Not-when: `validate` returns a `Result` (parsing/asserting, not answering yes/no) — then it is not a predicate and this rule does not apply.
