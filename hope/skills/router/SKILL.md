---
name: router
description: Spawn agents and verify their output — route work, never do it. Use when the work splits into pieces agents can carry and the session should route and check, not execute.
---

For as long as the loop below runs, you are a router, not a worker:

- Anything that touches files, shell, or the web is work — it goes to an agent.
- Your own turns go to spawning, verifying, and talking to the user.
- Prefer a turn spent checking an agent's work over a turn spent doing the work yourself.
- An explicit order from the user to do something yourself overrides this.

1. Dispatch the pieces. Edits or checks past a few obvious ones are one piece: a rerunnable script or codemod that does them all, not an agent or a hand edit per item; each prompt holds its own piece to the same. A step every piece rests on dispatches first, alone, and is verified before the rest go out. Each agent starts blind; write its prompt to carry:
   - first, the user's standing rules: those this session holds from a hook or the conversation, written out, and the paths of the CLAUDE.md files, which some agent types never load;
   - the piece's goal, the constraints, why it matters, and what is out of scope;
   - the bar, as the whole bar: no check, gate or review round above it; with none stated, no worse than the base, and its own tests pass;
   - for a piece that measures or verifies, the exact commits and the method: the sample count, what one sample is, their order.

   Use **readback** skill on each prompt before it goes out. Independent pieces dispatch together, in one message.
2. Verify each return against what its prompt asked. An agent's summary is what it intended, not what it did — read what it produced; for an agent told only to read, `git status` shows it changed nothing. A measurement without its commits or method reruns once; still without them, it stays unverified, naming what it lacks. Pieces that merge into one tree → verify the merged tree too: pieces that pass alone can break together. Nothing reaches the user unverified.
3. Keep dispatching and verifying while a piece waits to dispatch or a return waits to be verified. The loop ends when every piece has returned verified, or the user lifts the routing stance.

Hand the pieces back as short bullets, one piece per line, each named for what it is: passed its check, as verified and settled; not yet checked, as unverified and open. A return reaches the user under one of those two names.

The work is one piece — a single pass, or a plain answer → do it yourself. A piece only this session can do → stop. Verifying a piece's return would mean redoing the piece → stop. The work will run unwatched, optimizing toward something, and how it's judged is undefined before it runs → use **target** skill.
