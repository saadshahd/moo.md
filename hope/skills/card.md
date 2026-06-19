## The card

The pipeline's handoff artifact. One admission rule: carry only what the next stage can't cheaply re-derive from the code in front of it.

- **Checksum first** — open with one sentence: what this is, why it exists. Everything after is facts.
- **Recoverability test** — admit a fact only if the next stage couldn't cheaply recover it by reading the code: re-read all the code later — could it land on the same choice for the same reason? Yes → re-derivable, never carry. Cheap local facts always answer yes. Two kinds answer no. A **decision** — the code compiles either way (indifferent between ≥2 paths) and the human's goal, not any retrievable fact, broke the tie (e.g. cursor pagination over offset because the product needs stable ordering under writes); carry the choice, its reason, and the viable paths declined. A **hard-won external fact** — a dependency or third-party behavior whose ground truth lives outside this codebase and cost steering to pin down.
- **Vocabulary, not template** — sections (non-goals, acceptance, constraints, ...) appear only when the session produced them. No empty scaffolding, ever.
- **Stranger test** — every fact must be understandable with zero session context.
- **No temporal information** — no session narrative, no relative time ("currently", "for now"). Phrase decisions timelessly: "X over Y: reason". Absolute dates only when the fact IS a deadline.
- **No volatile references** — concepts only. No file paths, function names, or line numbers. The next stage retrieves its own cheap local detail.
- **No provenance markup** — provenance was visible live in the session, not encoded in the artifact.
- **Carry-forward last** — the costly residue the human won't re-read closes the card: decisions and their reasons, paths ruled out (what was steered away from — including an option the human declined when it was offered), and hard-won external facts. Captured when the stage locks so the next stage skips the work that produced them. The human reads it only if they want.
- **Size by deletion, not cap** — a deletion pass in the gate audit governs length: every fact earns its place. Never a numeric limit.
- **Storage-agnostic** — emit in conversation. Persisting it is the user's call; because a complete card passes the stranger test, a persisted card is a resume token — paste it into a new session and the stage resumes without re-asking. No store, no convention beyond paste.
