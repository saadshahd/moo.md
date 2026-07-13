---
paths: "**/*.{tsx,jsx}"
when: react
source: house
---
when: [react] · tier: standard · check: judgeable
Raw `useEffect` and `useRef` in a component are low-level plumbing that almost always stand for a higher declarative concept — a subscription, a debounce, a media query, a previous value, an intersection observer. Extract them into named hooks that describe INTENT (`useMediaQuery`, `usePrevious`, `useOnClickOutside`). A component with 2+ `useEffect`s is a code-review blocker.
WRONG:
```tsx
useEffect(() => {
  const mq = window.matchMedia('(min-width: 768px)');
  const on = () => setWide(mq.matches);
  mq.addEventListener('change', on); on();
  return () => mq.removeEventListener('change', on);
}, []);
```
RIGHT:
```tsx
const isWide = useMediaQuery('(min-width: 768px)');   // intent named, plumbing hidden
```
_Avoid_: a component holding 2+ `useEffect`s; inline subscription/debounce/observer wiring living directly in a component body instead of behind a named hook.
Detect: count `useEffect` calls per component — 2+ is the blocker; then classify each raw effect/ref as a concept (subscription, debounce, previous-value, observer) that wants its own named hook, or as evidence the component is doing too much.
Not-when: a genuinely one-off imperative bridge that no named concept fits and that isn't duplicated — a single effect can stay, but name what it synchronizes; the blocker is accumulation and un-named plumbing, not the primitive itself.
Cross-ref: two-effect-blocker-names-the-smell-not-just-the-count — how to classify each flagged effect (escape hatch vs event-in-disguise); derive-dont-sync — the effect that should have been a render-time derivation.
