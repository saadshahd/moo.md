---
when: always
source: Vergnaud
topic: abstraction
---
Introduce a type parameter only when it links two or more positions — an input's shape determines the output's shape, or two inputs must agree. If nothing downstream depends on the parameter, it's a design smell, not genericity.
_Avoid_: a generic function whose body never inspects or returns the parameter's structure.
Detect: for each type parameter, count its appearances in the signature — one appearance means it should be `unknown`, the concrete type, or deleted.
Not-when: the parameter is a phantom type deliberately used once to force call-site disambiguation (rare — must be named as such, not accidental).
