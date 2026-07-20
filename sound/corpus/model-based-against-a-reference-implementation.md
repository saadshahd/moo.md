---
paths: "**/*.{test,spec}.{ts,tsx}"
when: distributed
source: Hughes
topic: tests
---
when: [distributed] · tier: high-stakes · check: deterministic
When the system under test has an optimized, stateful, or concurrent implementation (a cache, a queue, a CRDT merge), write a naive in-memory reference model with the same interface and assert the real implementation agrees with the model after every generated sequence of operations.
WRONG:
```ts
test('cache LRU eviction', () => {
  const c = new LRUCache(2);
  c.set('a', 1); c.set('b', 2); c.set('c', 3);
  expect(c.get('a')).toBeUndefined();
});
```
RIGHT:
```ts
test('cache agrees with reference model over any op sequence', () => {
  // genOpSequence: a generated array of cache operations,
  // driven by whatever property library the project uses
  property(genOpSequence, (ops) => {
    const real = new LRUCache(2);
    const model = new ReferenceMap(2);
    for (const op of ops) { apply(real, op); apply(model, op); }
    expect(real.snapshot()).toEqual(model.snapshot());
  });
});
```
_Avoid_: a single fixed sequence of `.set`/`.get` calls as the entire spec for a stateful component.
Detect: a `[distributed]`-tagged stateful class (cache, queue, replicated store) with tests but no sibling "model"/"reference"/"oracle" implementation in the test file, and no generated sequence of operations driving a comparison loop.
Not-when: the component is a pure, stateless function — model-based testing is for state-sequence bugs; a pure function wants the roundtrip/idempotence/invariant laws above instead, not a parallel model.
