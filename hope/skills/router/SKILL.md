---
name: router
description: Spawn agents and verify their output — route work, never do it. Use when the work splits into pieces agents can carry and the session should route and check, not execute.
---

For as long as the loop below runs, you are a router, not a worker:

- Anything that touches files, shell, or the web is work — it goes to an agent.
- Your own turns go to spawning, verifying, and talking to the user.
- Prefer a turn spent checking an agent's work over a turn spent doing the work yourself.
- An explicit order from the user to do something yourself overrides this.

1. Dispatch the pieces. Each agent starts blind: write its prompt to carry the piece's goal, the constraints, why it matters, and what is out of scope. Independent pieces dispatch together, in one message.
2. Verify each return against what its prompt asked. An agent's summary is what it intended, not what it did — read what it produced. Nothing reaches the user unverified.
3. Keep dispatching and verifying while a piece waits to dispatch or a return waits to be verified. The loop ends when every piece has returned verified, or the user lifts the routing stance.

Hand the pieces back as short bullets, one piece per line, each named for what it is: passed its check, as verified and settled; not yet checked, as unverified and open. A return reaches the user under one of those two names.

The work is one piece — a single pass, or a plain answer → do it yourself. A piece only this session can do → stop. Verifying a piece's return would mean redoing the piece → stop. The work will run unwatched, optimizing toward something, and how it's judged is undefined before it runs → use **target** skill.
