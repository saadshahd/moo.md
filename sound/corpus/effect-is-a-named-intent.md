---
paths: "**/*.{tsx,jsx}"
when: react
source: house
topic: effects
---
when: [react] · tier: standard · check: judgeable
Raw `useEffect` and `useRef` in a component are low-level plumbing that almost always stand for a higher declarative concept — a subscription, a debounce, a media query, a previous value, an intersection observer. A component with 2+ `useEffect`s is a code-review blocker; fix it by classifying each effect. An *escape hatch* (synchronizing with an external system) is real — extract it into a named hook that describes INTENT (`useMediaQuery`, `usePrevious`, `useOnClickOutside`). An *event-in-disguise* (logic reacting to a state flag a handler just set) is not an effect at all — move it into that handler.
WRONG:
```tsx
useEffect(() => {
  const mq = window.matchMedia('(min-width: 768px)');
  const on = () => setWide(mq.matches);
  mq.addEventListener('change', on); on();
  return () => mq.removeEventListener('change', on);
}, []);
useEffect(() => {
  if (submitted) sendAnalytics('form_submitted'); // reacting to a flag a handler set — an event in disguise
}, [submitted]);
```
RIGHT:
```tsx
const isWide = useMediaQuery('(min-width: 768px)');   // escape hatch: intent named, plumbing hidden
function handleSubmit() {
  setSubmitted(true);
  sendAnalytics('form_submitted');                    // event-in-disguise: moved into the handler
}
```
_Avoid_: inline subscription/debounce/observer wiring in a component body instead of behind a named hook; an effect whose trigger is "a state flag I just set a few lines away in a handler."
Detect: count `useEffect` calls per component — 2+ is the blocker; then classify each as an escape hatch (synchronizing with an external system → its own named hook) or an event-in-disguise (its dependency array traces back to a specific user action in a handler → belongs in that handler).
Not-when: a genuinely one-off imperative bridge that no named concept fits and that isn't duplicated — a single effect can stay, but name what it synchronizes; or the "event" must fire for every code path that changes the state (a parent, a route change, three different handlers), not just this one — then the effect is the only place reachable from all of them.
Cross-ref: derive-dont-sync — the effect that should have been a render-time derivation.
