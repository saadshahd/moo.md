---
description: Run the full hope pipeline — intent, shape, target, freeze as needed — then execute
---

# /hope:full

**Task:** $0

The pipeline is a graph over four composers plus the work itself. Each composer is its own skill — call it by name with the Skill tool; it routes what blocks it and ends when the user confirms or locks its result. Say where you are at each hop, one line: `intent | shape | target | execute | done | stopped`.

## The graph

Start at the first line that is true:

- The ask is rough, unspoken, or double-readable → **intent**.
- The ask is confirmed but more than one way to build it remains → **shape**.
- The ask is confirmed and the path is obvious → execute.

Hops:

- **intent** ends → **shape**; or straight to execute when the path is obvious.
- **shape** ends → execute when a human watches each step; → **target** when the work will run unwatched. The ask itself comes open mid-shape → back to **intent**.
- **target** ends with the contract locked → execute. Success cannot be made mechanical → back to **shape**: the path, not the contract, is the problem.
- Any stage meets facts that live outside the repo — a service, a database, a queue, live logs → **freeze**, then resume where it left off.
- Execute: the path breaks mid-work → back to **shape**. The confirmed ask is met → done.
- intent never hops straight to **target**: nothing decided means nothing to judge. Shape first, or the user states the path now.
- The user stops, or the task dissolves → say so and stop. Never end silently.
