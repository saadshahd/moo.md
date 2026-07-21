---
when: always
source: Evans
topic: naming
---
One domain concept gets exactly one name across code, types, tests, and commit messages — a synonym for an existing concept is a language defect, not a style choice.
_Avoid_: two or more of `user`/`client`/`customer`/`account`, or `record`/`entity`/`row`, naming the same referent within one bounded context.
Detect: grep type names, function names, and parameter names for near-synonym clusters referring to the same underlying concept; a domain expert asked "what do you call this?" should get one answer, not a pick from the codebase's three.
Not-when: the words genuinely name different concepts (a `User` who logs in vs. a `Customer` who buys — two roles the same person can hold are still two types, not a naming defect).
