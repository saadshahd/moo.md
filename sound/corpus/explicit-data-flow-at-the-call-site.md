---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: effects
---
when: [always] · tier: standard · check: judgeable
Data flow must be readable from the call site: a reader traces what happens to a value without jumping into implementations. If a value is derived, show the derivation where it's used; if a side effect happens, make it visible where it's triggered. No action-at-a-distance — nothing that mutates shared state or fires an effect from inside a call that looks pure.
WRONG:
```ts
applyDiscount(cart); // mutates cart.total in place, no return
render(cart);        // reader can't tell total changed
```
RIGHT:
```ts
const discounted = applyDiscount(cart); // derivation visible at the call site
render(discounted);
```
_Avoid_: functions that mutate an argument or a module-level value as a hidden side effect; derived values computed deep inside a callee where the call site shows nothing.
Detect: read the call site alone — if you cannot tell which values changed or what effects fired without opening the callee, the flow is implicit. Look for void-returning calls whose real output is a mutation of the argument.
Not-when: a deliberately encapsulated builder or reducer whose contract is a returned new value, and whose mutation (if any) is local to a value it owns.
