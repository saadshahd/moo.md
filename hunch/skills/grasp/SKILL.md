---
name: grasp
description: Use when the user asks to explain a code change, diff, branch, or PR — or wants to catch up on what an agent built before reviewing or shipping it.
---

# grasp

The reader is not verifying — they're staying a participant. Understanding is what lets them have the next idea. Build it the way education does: background, intuition, code, then proof of understanding.

## Before writing

Explore the surrounding system, not just the diff. The explainer teaches what was already there before what changed.

## Sections, in order

1. **Background** — the system as it was. Two layers: deep context a newcomer needs (marked skippable), then the narrow slice this change touches.
2. **Intuition** — the goal and the core idea before any code. Concrete examples with toy data. A small family of diagrams reused throughout — never ASCII.
3. **Code** — a literate walkthrough: conceptual order, not file order; prose that embeds the key snippets. The raw diff is the appendix, not the explanation.
4. **Quiz** — five multiple-choice questions on the substance of the change. Medium difficulty: answerable only with real understanding, no gotchas. Every option gets feedback explaining why it's right or wrong.

## The quiz is a speed regulator

The loop runs faster than human understanding; the quiz is the counterbalance. Invite the reader to hold the change until they pass — shipping past a failed quiz banks cognitive debt. Feedback per question only; never a score, streak, or grade.

## Format

- Medium is the user's call. Default: one self-contained HTML file outside the repo, named `YYYY-MM-DD-<slug>.html`, quiz interactive.
- Write with the clarity and flow of Martin Kleppmann — smooth transitions, callouts for key concepts and edge cases.
- Code blocks keep their newlines: `<pre>`, or `white-space: pre-wrap` on styled divs.
