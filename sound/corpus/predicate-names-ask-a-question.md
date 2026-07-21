---
when: always
source: house
topic: naming
---
Boolean-returning names answer a yes/no question: `is*` / `was*` / `should*` / `does*`. Now-vs-then pairs differ by tense only — `isX` is current state, `wasX` is prior state. Ban `validate` and `check` as predicate names; they hide the question the boolean answers.
_Avoid_: a `boolean`-returning function named `validate*`, `check*`, or any bare verb that does not read as a yes/no question.
Detect: a function whose return type is `boolean` and whose name does not start with `is`/`was`/`should`/`does`/`has`; `validate`/`check` returning a boolean.
Not-when: `validate` returns a `Result` (parsing/asserting, not answering yes/no) — then it is not a predicate and this rule does not apply.
