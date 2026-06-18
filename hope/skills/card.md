## The card

The pipeline's handoff artifact. One admission rule: carry only what the next stage can't cheaply re-derive from the code in front of it.

- **Checksum first** — open with one sentence: what this is, why it exists. Everything after is facts.
- **Recoverability test** — admit a fact only if the next stage couldn't cheaply recover it by reading the code. Cheap local facts get re-read, never carried. Two kinds survive: decisions (code can't say why X over Y — only the human's goal settles it) and hard-won external facts (dependency or third-party behavior whose ground truth lives outside this codebase and cost steering to pin down).
- **Vocabulary, not template** — sections (non-goals, acceptance, constraints, ...) appear only when the session produced them. No empty scaffolding, ever.
- **Stranger test** — every fact must be understandable with zero session context.
- **No temporal information** — no session narrative, no relative time ("currently", "for now"). Phrase decisions timelessly: "X over Y: reason". Absolute dates only when the fact IS a deadline.
- **No volatile references** — concepts only. No file paths, function names, or line numbers. The next stage retrieves its own cheap local detail.
- **No provenance markup** — provenance was visible live in the session, not encoded in the artifact.
- **Carry-forward last** — the costly residue the human won't re-read closes the card: decisions and their reasons, paths ruled out (what was steered away from), and hard-won external facts. Captured when the stage locks so the next stage skips the work that produced them. The human reads it only if they want.
- **Size by deletion, not cap** — a deletion pass in the gate audit governs length: every fact earns its place. Never a numeric limit.
- **Storage-agnostic** — emit in conversation. Persisting it is the user's call.
