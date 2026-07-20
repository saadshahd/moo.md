## The card

The pipeline's handoff artifact. One admission rule: carry only what the next stage can't cheaply re-derive from the code in front of it. Recoverability test: re-reading all the code later, could it land on the same choice for the same reason? Yes → never carry (cheap local facts always answer yes). Two kinds answer no:

- **Decision** — the code compiles either way; the human's goal, not any retrievable fact, broke the tie between viable paths. Carry the choice, its reason, and the paths declined (including options the human turned down when offered).
- **Hard-won external fact** — dependency or third-party behavior whose ground truth lives outside this codebase and cost steering to pin down.

Form:

- Open with one sentence: what this is, why it exists. Everything after is facts.
- Sections (non-goals, acceptance, constraints, ...) appear only when the session produced them. No empty scaffolding, ever.
- Stranger test: every fact understandable with zero session context.
- Timeless: no session narrative, no relative time ("currently", "for now"). Phrase decisions "X over Y: reason". Absolute dates only when the fact IS a deadline.
- Concepts only: no file paths, function names, or line numbers — the next stage retrieves its own cheap local detail. No provenance markup.
- Carry-forward closes the card: decisions and reasons, paths ruled out, hard-won external facts — captured when the stage locks so the next stage skips the work that produced them.
- Size by deletion pass in the gate audit, never a numeric cap.
- Emit in conversation; persisting is the user's call. A complete card passes the stranger test, so a persisted card is a resume token — paste it into a new session and the stage resumes without re-asking.
