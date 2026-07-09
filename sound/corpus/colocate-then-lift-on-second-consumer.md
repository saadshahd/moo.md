---
paths: "**/*.{tsx,jsx}"
when: react
source: Abramov
---
when: [react] · tier: standard · check: judgeable
State starts in the component that owns the interaction; lift it only when a second component genuinely needs to read or drive it — never lift preemptively "in case it's needed later."
WRONG:
```tsx
const AppState = createContext({ isDropdownOpen: false, setDropdownOpen: (v: boolean) => {} });
// consumed by exactly one <Dropdown>, three files away
```
RIGHT:
```tsx
function Dropdown() {
  const [isOpen, setIsOpen] = useState(false);
  // ...
}
```
_Avoid_: single-consumer state placed in a parent, context provider, or global store "for future flexibility."
Detect: for each piece of lifted state, count actual current call sites that read or write it — if the count is one, it's mis-colocated.
Not-when: two sibling components already both need it now (not hypothetically), or the state must survive the owning component's unmount (e.g. a wizard step surviving navigation) — that's a real lift, not premature one.
Cross-ref: the delete-vs-date ladder (deletion-test-before-any-abstraction-ships · speculative-generality-guard · seam-earns-existence-at-second-adapter · colocate-then-lift-on-second-consumer): judge an unused abstraction in this order — (1) COUNT: a second consumer/adapter already exists (a test double counts) → it has earned existence; (2) DATED TRIGGER: the second member is named in scoped, scheduled work today → a deliberate seam; the schedule is the license; (3) otherwise the DELETION TEST rules → cut. The defect is never the seam itself — it is the unscheduled one.
