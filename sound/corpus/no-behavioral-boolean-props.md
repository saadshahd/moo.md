---
when: react
source: house
topic: abstraction
---
Never add `loading?`, `disabled?`, `fullWidth?`, or any behavioral boolean prop to a component's props type — not even one. These are composition concerns, not props. "Loading support" is a SEPARATE wrapper component. `fullWidth` is a CSS class or a `<FullWidth>` layout wrapper. Compose through `children` and slots (`React.ReactNode`).
_Avoid_: a base component that grows variant behavior through boolean toggles instead of wrappers and slots.
Detect: grep component props types for `loading?: boolean`, `disabled?: boolean`, `fullWidth?: boolean` and other behavioral boolean fields — each should be a wrapper component, a CSS class, or a slot instead.
Not-when: discriminated unions over a domain model's own props — the ban is on behavioral variant toggles, not on modeling genuine domain states, and not on variant props where a discriminated union's narrowing tax would exceed its benefit.
