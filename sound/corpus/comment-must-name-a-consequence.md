---
when: always
source: house
topic: naming
---
Inline comments are a smell: if a line needs explaining, rename, extract, or restructure until it doesn't. Block comments are acceptable only where the code cannot be made self-describing — a regulatory constraint, a non-obvious performance decision, a workaround for an external bug — and they explain WHY, never WHAT. A `//` comment survives only when omitting it would let a future editor silently break a non-obvious constraint, so it MUST name a consequence or an external-system mapping. A comment that narrates the edit rather than the code — "updated to fix X", "now also handles Y", "changed from Z" — is always wrong: change history belongs in the commit message, not the source.
_Avoid_: a comment that restates the code beneath it in English; a WHAT-narration of a loop, assignment, or call; step-by-step narration of a function body; a comment narrating the edit's history ("updated", "was", "now", "previously") instead of the code's present behavior.
Detect: read each comment against its line — if the line's identifiers already say what the comment says, delete it. The one sanctioned inline exception is a comment stating a type or shape the code cannot express on its own, documenting SHAPE only — never behavior.
Not-when: the comment encodes a genuine external constraint (regulation, a documented upstream bug, a measured performance tradeoff) that the code cannot express on its own — keep it, and make it name the WHY.
