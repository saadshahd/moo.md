---
name: target
description: Define how unsupervised work is judged before it runs. Use when work will run without a human watching, optimizing toward something.
---

## Build

Success is defined before the run, not by it. Build the contract by invoking each named skill with the Skill tool where its condition holds:

- What "done" means reads two ways that would build different things → use **clarify** skill.
- The user holds a bar they can't yet state → use **elicit** skill.
- Nothing exists to react to yet → use **draft** skill on the contract itself: one observable that means done — a single reading, not a dashboard — the literal command that reads it, which direction is better and the value that ends the work, a cap that ends it even unmet, what must keep passing while optimizing, and every choice made on the user's behalf surfaced.
- Any part leans on someone's judgment — "clean", "better", "reasonable" → use **anchor** skill: replace it with a trigger a machine evaluates identically every time. The dry run is the anchored rule deciding one real case — record the value it reads now. A command that will not run fails here, loudly.
- The drafted contract → use **judge** skill, on the claim: the cheapest way to pass is the real work. Start from the known false-pass catalog in `cheat-museum.md`, then hunt false passes specific to this contract.

Each open false pass judge finds re-enters as an amendment — back through the drafting and anchoring conditions above — until the verdict stands.

## The contract

Hand it back as short bullets, one part per line: each part the drafting named, the dry-run value recorded, each cheap false pass closed. It locks only when judge's verdict stands and the user locks it.

Two things stay open for the human alone, before the run starts: capping the spend with a disposable key, since the contract bounds correctness and only the key bounds cost; and watching the first cycle to see the run use what the contract names.

If the running work later games the contract, the cheat is a bug in the contract: amend it here and rerun from the last honest point.

A human will watch each step → no contract needed; proceed with the decided path. Success cannot be made mechanical → the work is not ready to run unsupervised — say so and stop.
