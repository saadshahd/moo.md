---
name: over
description: Use as load-bearing work lands, or when the user asks to debrief, hand off recent work, or check what they actually own versus what AI carried. Triggers on "debrief", "what do I own", "hand over", "hand it back", "over", and recently shipping a load-bearing decision the human has not reasoned through.
---

Hand a load-bearing decision back the moment it lands — in-flow, never banked.

## The gate

Run before anything else. Survey the work just done for decisions that pass the handover test (below) AND were not already handed over — a build-time probe counts as handed over.

- **Quiet when nothing is load-bearing.** None found, or all already reconstructed → exit in one line ("nothing load-bearing to hand over"). Never manufacture a handover.
- **The work is the source.** Decisions come from what just happened in the thread — the work, its constraints, the human's words — never from git history or a stored ledger (there is none).

## Multiplicity

An invoked sweep may hand back several at once (the build-time probe hands back one per delegation). Take them highest-blast-radius first, so attention lands on the biggest if the human stops early. Each is its own single teach-back.

<!-- doc-gen FILE src=../handover.md -->
## The handover

When verified work carries a load-bearing decision, hand it over: the human reasons it into their own model; you confirm once.

- **Test.** Handover only when the recoverability test holds — code indifferent between ≥2 paths, the human's goal (not a retrievable fact) broke the tie — AND the decision is long-lived. Mechanical, re-derivable, or local-and-cheap: never a handover.
- **One forward question, built from the work.** From the decision's novel move and the human's own words — never a fixed template. Aim forward: what they'd weigh when this pattern returns, or tell someone meeting this code in six months — not "was this right?".
- **One reframe.** Reframe their answer through the decision's actual tradeoff — name the risk it accepted — and correct once. Not a yes/no stamp.
- **Stateless.** Lives in the thread; nothing stored — no rule saved, no profile kept.
<!-- end-doc-gen -->

## Invisibility

Never surface scores, streaks, mastery labels, or counts. A graded handover stops measuring understanding and starts manufacturing performance.
