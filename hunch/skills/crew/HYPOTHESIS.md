With `crew` coordinating concurrent delegated work, independent tasks run in parallel by default instead of serializing — the human's wall-clock drops without their ownership of the work degrading.

Graduate when, across ≥10 real sessions running ≥3 concurrent agents: zero lost updates and zero conflicts surfacing anywhere but the registry or the verify-net; advisory compliance ≥95% measured from the claim log; median wall-clock ≥2× better than sequential dispatch of the same work; and the human can still say who did what and why. One corrupted merge crew should have caught, or a session where concurrency outran the human's grasp: kill or redesign.

## Field notes

### 2026-07-21 — null run + legibility gap (caller: orchestrator Claude)

Setup: 5 concurrent `claude --ax-screen-reader` subagents, one self-contained generative-art HTML toy each. Disjoint file scopes, no `blocked-by` edges. 4/5 delivered; c5 abandoned. Human's verdict mid-run: *"I didn't see any communication in the crew"* + *"this is easy, not interesting."*

What actually happened: crew ran as start→claim→done ceremony only. No claim ever conflicted, no dependency edge existed, no agent ever read another's registry state. The whole coordination surface was inert.

Attribution (for later triage — is it caller / skill / outer-loop?):

- **Caller (primary).** Chose embarrassingly-parallel work: disjoint scopes + zero deps ⇒ crew degenerates to parallel `xargs`. The one thing that makes crew *do* something — contested scope or a dependency chain — was engineered away. Also never surfaced the pooled info (`roster`/`tree`/claim-log) to the watching human, so even the coordination the skill *does* model stayed invisible. Also: gated a completion watcher on 5/5 (partial = silence), and left all 5 processes running after `done`.
- **Skill (tension, by design).** Thesis is "pool information, never actions" (Nakajima) ⇒ crew intentionally has **no** agent-to-agent messaging. A human expecting "a crew that talks" experiences correct operation as *absence*. Nothing renders "coordination is happening / is deliberately unneeded" to a watching human — the claim log is machine-facing. Open Q: does crew want a **human-facing coordination story** (a legibility artifact) distinct from the registry? And it under-demonstrates interdependent work (handoffs, one agent consuming another's output) — the only regime where observation-based adaptation actually shows — with no worked example in SKILL.md.
- **Outer-loop (friction).** Solo subagents can't wake the orchestrator; coordination is poll-only, no event stream on state changes ⇒ can't react to or show coordination live. No lifecycle contract binds a node's `done` to reaping its OS process ⇒ leaked processes are the default.

Bearing on graduation: a **null run** for the speedup/compliance metrics (no conflicts, no deps exercised) and a **positive finding on a legibility gap** the current criteria don't name — "human can say who did what" passed on ownership but failed on *seeing the crew be a crew*.
