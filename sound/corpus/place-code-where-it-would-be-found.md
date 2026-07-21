---
when: always
source: house
topic: placement
---
Place code where it would be FOUND by someone who doesn't know it exists — next to the domain concept it serves, not next to the feature that first needed it. If a computation is used by 2+ domains, move it to the nearest common ancestor domain both consumers already belong to, never to a grab-bag.
_Avoid_: a helper imported across bounded contexts from deep inside the one feature folder that first defined it; a domain concept parked in the UI/route module that happened to need it first.
Detect: an export imported by files from 2+ sibling domains while it lives inside just one of them — it belongs at their common ancestor.
Not-when: the code genuinely serves exactly one domain and no other consumer exists — leave it there; don't hoist speculatively toward reuse that hasn't arrived.
Cross-ref: feature-envy-misplacement — the smell that says a function sits in the wrong module; colocate-then-lift-on-second-consumer — the react-state instance; no-role-named-modules — the grab-bag ban itself.
