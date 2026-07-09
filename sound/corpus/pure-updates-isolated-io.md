---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
The invariant is universal: an update to a shared state tree returns a NEW tree — never mutate in place — and the IO that triggered it lives at the edge, never threaded into the update. The named-optic/lens MECHANISM is project-idiom-gated: where optics are already the house style, reach for a named optic at nested or multi-field updates; where they are not, plain spread updates satisfy the same invariant. Never impose optics on a project that doesn't already use them.
WRONG:
```ts
async function markDone(state: Tree, id: string) {
  const node = state.items.find(i => i.id === id);
  node.done = true;                 // in-place mutation of the shared tree
  await db.save(state);             // IO threaded into the update
  return state;
}
```
RIGHT:
```ts
const markDone = (state: Tree, id: string): Tree => ({
  ...state,
  items: state.items.map(i => i.id === id ? { ...i, done: true } : i),
});
// the caller at the edge performs the IO: const next = markDone(...); await db.save(next);
```
_Avoid_: assigning into a field of a shared state tree; `await`/`fetch`/`db.*`/logging inside an update function instead of at the calling edge.
Detect: an update function that assigns to a property of its input tree, or that performs IO in its body — both violate the invariant regardless of the project's optic idiom.
Not-when: the value is genuinely local and un-shared — an ordinary local mutation before it escapes is fine; the invariant governs shared state trees. And absent an optics house style, don't add a lens library to satisfy it — a spread is enough.
Cross-ref: place-not-value-for-shared-mutable-state — why the invariant exists; no-mutable-shared-return — the same discipline at a function's return boundary.
