---
paths: "**/*.{ts,tsx}"
when: always
source: Vergnaud
---
when: [always] · tier: standard · check: judgeable
Introduce a type parameter only when it links two or more positions — an input's shape determines the output's shape, or two inputs must agree. If nothing downstream depends on the parameter, it's a design smell, not genericity.
WRONG:
```ts
function wrap<T>(value: T): { value: T } { return { value }; } // T only appears once — add nothing, remove nothing
function log<T>(label: string, value: T): void { console.log(label, value); } // T never reappears — just `unknown`
```
RIGHT:
```ts
function first<T>(items: [T, ...T[]]): T { return items[0]; }  // T links input to output
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key]; }
// K is constrained by T (a real relationship), and T[K] links the return type to both inputs
```
_Avoid_: a type parameter that appears exactly once across the whole signature; a generic function whose body never inspects or returns the parameter's structure.
Detect: for each type parameter, count its appearances in the signature — one appearance means it should be `unknown`, the concrete type, or deleted.
Not-when: the parameter is a phantom type deliberately used once to force call-site disambiguation (rare — must be named as such, not accidental).
