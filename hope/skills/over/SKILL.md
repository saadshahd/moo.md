---
name: over
description: Use at session wind-down, or when the user asks to debrief, hand off recent work, or check what they actually own versus what AI carried. Triggers on "debrief", "what do I own", "hand over", "wrap up", "over", and a winding-down session that produced a load-bearing decision.
---

Session-end handover. A debrief is a conversation, not a score. The session is the survey — read it, find what is load-bearing, hand it back so the human keeps the capacity to own what shipped.

## The gate

Run before anything else. Survey the session for decisions that pass the handover test (below) AND were not already handed over this session — a build-time probe counts as handed over.

- **Quiet on a thin session.** Nothing load-bearing, or every load-bearing decision already reconstructed → exit in one line ("nothing load-bearing to hand over"). Never manufacture a handover.
- **The session is the source.** Decisions come from what happened in the thread — the work, its constraints, the human's words — never from git history or a stored ledger (there is none).

## Multiplicity

Unlike build-time return — one handover per delegation — session-end may hand over several. Take every un-reconstructed load-bearing decision, highest-blast-radius first, so attention spent lands on the biggest if the human stops early. Each is its own single teach-back.

<!-- doc-gen FILE src=../handover.md -->
## The handover

A held mental model can't be handed to another mind — only rebuilt there. When verified work carries a decision worth owning, hand it over: the human rebuilds, you confirm once.

- **The handover test.** A decision is worth a handover only when it is load-bearing: the recoverability test holds — code indifferent between ≥2 paths, the human's goal (not a retrievable fact) broke the tie — AND it is long-lived / load-bearing. Mechanical, re-derivable, or local-and-cheap decisions are never handovers.
- **Probe forward, generated from the work.** Pose ONE question per handover, built from the decision's novel move and the human's own words — never a fixed template. Aim it forward: what they would weigh the next time this pattern returns, or what they would tell someone meeting this code in six months — not "was this right?". The forward question elicits the rule; re-justifying the past does not.
- **Confirm by reframing, once.** The human answers; you reframe their answer through the decision's actual tradeoff — name the risk it accepted — and correct once. Not a yes/no stamp. One question in, one reframe out.
- **Stateless.** The exchange lives in the thread; nothing is stored — no rule saved, no profile kept. All signal is live.
<!-- end-doc-gen -->

## Invisibility

Never surface scores, streaks, mastery labels, or counts. A handover that gets graded stops measuring understanding and starts manufacturing performance.
