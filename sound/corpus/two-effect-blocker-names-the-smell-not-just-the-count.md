---
paths: "**/*.{tsx,jsx}"
when: react
source: Abramov
---
when: [react] · tier: standard · check: judgeable
A component flagged for effect overuse is fixed by classifying each effect: an *escape hatch* (synchronizing with an external system — keep it, extract to a named hook) or an *event-in-disguise* (logic reacting to a state flag a handler just set — move it into that handler).
WRONG:
```tsx
useEffect(() => {
  if (submitted) sendAnalytics('form_submitted');
}, [submitted]);
```
RIGHT:
```tsx
function handleSubmit() {
  setSubmitted(true);
  sendAnalytics('form_submitted');
}
```
_Avoid_: an effect whose trigger is "a state flag I just set a few lines away in a handler."
Detect: for each effect in a component, trace its dependency array back to whether a specific user action (not a derived render) caused the change — if yes, that logic belongs in the handler.
Not-when: the "event" must fire for every code path that changes the state (not just this handler) — e.g. state changed by a parent, a route change, or three different handlers — then the effect is the only place that's actually reachable from all of them.
Cross-ref: effect-is-a-named-intent — the 2+-effect blocker that triggers this classification.
