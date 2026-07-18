---
paths: "**/*.{ts,tsx}"
when: always
source: Feathers
topic: abstraction
---
when: [always] · tier: standard · check: judgeable
When adding new behavior to an existing function that lacks tests or is already doing too much, write the new logic as a separate, independently-testable function/class called from the old one, rather than growing the old function's body inline.
WRONG:
```ts
function processOrder(order: Order) {
  // ...200 lines of untested existing logic...
  if (order.hasGiftWrap) {          // new behavior grown inline
    order.total += giftWrapFee(order)
  }
}
```
RIGHT:
```ts
function processOrder(order: Order) {
  // ...200 lines of untested existing logic, untouched...
  order.total += GiftWrap.feeFor(order)  // sprouted, independently tested
}
```
_Avoid_: adding new conditionals/branches directly into an already-large, untested function body
Detect: a diff that adds new logic as inline statements inside a pre-existing untested function, where that logic could instead be a standalone named unit called once
Not-when: the existing function is already small and well-tested — then inline extension is fine and sprouting is ceremony; also not-when the new behavior is inseparable from the surrounding state (rare — justify explicitly)
