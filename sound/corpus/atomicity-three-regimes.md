---
when: always
source: Feathers, house
topic: effects
---
Atomic-over-gradual is absolute at the contract level: no v2 interfaces, no deprecation layers, no two parallel call-site contracts. Below that, the mechanic scales with deploy blast radius. Regime 1 — one deployable unit, tested code: change atomically, no scaffolds. Regime 2 — one unit, untested code: characterization tests pin behavior first, a sprouted function sits beside the old one only while it proves itself, and the change is not done until the old path is deleted. Regime 3 ([distributed]) — across deployable units: atomic deploy is physically impossible (rollout overlap, in-flight messages from old writers), so expand → migrate → contract is mandatory, and the taste-enforceable part is that the contract step is scheduled at expand time. Discriminating question: is this a shipped state (banned) or a transition mechanic with its deletion already scheduled (required)?
_Avoid_: a sprouted/parallel function that survives its migration series; a compat shim with no dated contraction; two call-site contracts for one operation.
Detect: a `*Next` / `*V2` sprout still called after its migration should have completed; a cross-unit compat layer with no scheduled deletion.
Not-when: a genuine transition mechanic whose contract step is already scheduled at expand time — that's required, not a defect.
Cross-ref: seam-is-not-a-v2-interface — the contract-level absolute; sprout-over-inline-growth and characterize-before-refactor — regime 2's mechanics; serialized-data-outlives-its-writer — why regime 3 exists.
