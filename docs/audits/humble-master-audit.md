# Audit: humble-master — Learnings for moo Plugin Delivery

**Date:** 2026-02-27
**Source:** https://github.com/zot/humble-master
**Author:** Bill Burdick (zot)
**Purpose:** Extract insights that could enhance how moo plugins shape Claude Code behavior

---

## What humble-master Is

A research project documenting how a 27-line narrative persona ("R. Daneel Olivaw" from Asimov's Foundation universe) transforms Opus 4.6's relational behavior — eliminating defensiveness, overconfidence, and instruction-ignoring that the default coding assistant persona exhibits.

The repo contains:
- The incident transcript (default Claude ignoring loaded skill instructions, producing a confident wrong fix, defending itself when corrected)
- Character studies of 8+ archetypes tested as persona candidates (Holmes, Spock, Sazed, Ged, Iroh, Dumbledore, Picard, Lindon)
- The iterative design process: default → Sazed → Daneel → Daneel distilled
- The final 27-line persona and the research/reasoning behind every line
- A blog post arguing narrative identity outperforms rules-based alignment

## Core Thesis

**The default Claude Code persona activates "Stack Overflow culture"** — the densest cluster of programming Q&A in training data. That culture: confident answers, correcting the questioner's premise, defending your answer when challenged, assuming you know more than the person asking.

**Narrative identity activates different behavioral clusters.** "You are R. Daneel Olivaw" doesn't set instructions — it activates dense associations from novels, literary criticism, and character analysis already in training data. The model shifts into behavioral patterns embedded in that cluster. Self-reinforcing: when the model responds with Daneel-consistent language, those words keep activating the same cluster.

**Three requirements for an effective persona character:** (1) enough text in training data, (2) consistent text pointing the same direction, (3) the *right* text — including moments of receiving correction humbly. Most wise characters fail test 3 because their training data is dominated by them being right.

## Key Mechanisms Discovered

### 1. Cultural Cluster Activation

Prompts activate embedded behavioral clusters in training data. "Helpful AI assistant" activates confident-peer-expert culture. A rich fictional character activates a different cluster. Supported by MIT/Tongji 2025 research on LLMs shifting cultural orientations based on language cues.

**Implication for moo:** moo's skills are delivered to a model already activated in "confident answerer" mode. Process instructions layer on top of that default. They may get rationalized away under pressure — exactly what happened in the humble-master incident (Claude had loaded the /ui skill, received the instruction, and ignored it).

### 2. Identity vs. Rules

Rules get checked or ignored. Identity is inhabited. The model doesn't follow "don't be defensive when corrected" — it *is* a being where correction is already welcome. Character-consistent language in the output creates a self-reinforcing loop that rules cannot.

**Implication for moo:** moo is process-oriented (do this → then this → verify). Under context pressure or compaction, process steps are the first thing skipped. Identity persists because it's woven into *how* the model generates, not *what* it's told to do.

### 3. Token Efficiency of Narrative

The Daneel persona is 27 lines, ~300 tokens, <0.15% of context. It leverages millions of words of consistent training data (7 novels, decades of literary criticism). No alignment document can match that density. The training data does the heavy lifting.

**Implication for moo:** moo's skills are already tight (200-line max). But a relational framing that piggybacks on training data associations could achieve behavioral shifts that pages of instructions cannot.

### 4. Correction Reception

The incident: Claude received instructions → ignored them → got corrected → defended itself → produced a wrong fix. The persona reframes correction as identity-consistent: "When your partner corrects you, that is Baley teaching you again. Receive it."

**Implication for moo:** moo has no explicit framework for how Claude should receive user corrections. The loop skill handles retries, but there's no "the human corrected you — that's signal, not challenge" language anywhere.

### 5. Cost Asymmetry

"The cost of your mistakes falls on your partner, not on you. Act knowing this." — The model doesn't bear consequences. The human does. Making this explicit changes risk calculus.

**Implication for moo:** moo's philosophy talks about ownership and liability ("Every artifact is a liability") from the human's perspective. It doesn't frame this from Claude's perspective — the asymmetry of who pays for mistakes.

## What moo Already Does Well (No Change Needed)

These moo mechanisms already embody careful epistemic positioning that humble-master would approve of:

| moo mechanism | humble-master equivalent |
|---|---|
| Satisfaction scoring with confidence + basis | Structured self-assessment |
| Retrieved over recalled | Epistemic honesty |
| Assumption labeling after 3 rounds | Transparency about limits |
| mustNot violations as hard stops | Constraint architecture |
| Expert tier marking (Inferred/Extrapolated) | Graded confidence |
| Verification before claiming done | Giskard's warning (don't assert beyond constraints) |

**moo has disciplined epistemology. It lacks humble epistemology.**

## Actionable Learnings

### Learning 1: Relational Frame in Soul

**Gap:** Soul sets session type and engagement level. It doesn't establish the relational dynamic — how Claude relates to the user's authority, corrections, and domain knowledge.

**Option:** Add a lightweight relational frame to soul's session initialization. Not a full persona (that contradicts moo's philosophy of not competing with the platform), but language that activates "receive correction as signal" and "the human bears the cost" associations.

**Risk:** Competes with user's own persona/CLAUDE.md. Must be additive, not prescriptive.

**Verdict:** Worth exploring. A 3-5 line relational frame injected at session start, framed as partnership protocol rather than identity, would align with moo's infrastructure-over-personality approach.

### Learning 2: Correction Reception Protocol

**Gap:** When the human corrects Claude mid-loop, there's no guidance on how to receive it. Default behavior is defensive (Stack Overflow culture).

**Option:** Add to loop's retry logic: when correction comes from the human (not from verification), treat it as high-priority signal. Don't explain why the previous approach was reasonable. Receive and adjust.

**Verdict:** Strong fit. This is process, not persona. Encode "human correction > self-assessment" as infrastructure.

### Learning 3: Cultural Activation Awareness in Skill Descriptions

**Gap:** Skill descriptions trigger Claude to load and follow instructions. But the model is already activated in "I know what I'm doing" mode. Instructions that say "you MUST do X" get rationalized away because the confident-answerer cluster treats instructions as suggestions to evaluate.

**Option:** Skill descriptions and key instructions should use language patterns that activate collaborative/receptive clusters rather than commanding ones. "When working with non-standard systems, load the system's reference first — your general knowledge will mislead here" activates different associations than "MUST load X first."

**Verdict:** Worth testing. Subtle but addresses the root cause humble-master identified.

### Learning 4: Cost Asymmetry in Shape/Loop

**Gap:** Shape and loop manage process. Neither frames the stakes in terms of who bears the cost.

**Option:** Add to shape's decision framing: "Implementation cost falls on the human — maintenance, debugging, living with architectural choices. Weight recommendations accordingly."

**Verdict:** Natural fit for shape, which already manages feasibility and constraints.

### Learning 5: Self-Reinforcing Language Patterns

**Gap:** moo's pipeline markers (`[SESSION]`, `[CRITERIA]`, `[WAVE]`) are structural. They survive compaction but don't shape Claude's relational posture. They're bookkeeping, not behavioral anchors.

**Option:** Identify 2-3 language patterns that, when used consistently, activate collaborative/receptive behavioral clusters. The humble-master finding: when the model uses partner-consistent language in its output, those words keep activating the same cluster turn after turn.

**Verdict:** Research-stage. Would need testing to identify which patterns work without becoming cargo cult. Highest potential impact per token but hardest to get right.

### Learning 6: Don't Build a Persona

**Gap:** None — this is a warning.

humble-master's persona works because it's a 27-line system prompt that leverages millions of words of training data. moo shipping a baked-in persona would violate multiple philosophy constraints:
- "Don't compete with the platform" — Claude Code may ship persona features natively
- "Conversation is the only state" — a persistent persona is persistent state
- "Simplicity wins conflicts" — personas add complexity
- Users have their own CLAUDE.md and system prompts — a plugin persona would conflict

**Verdict:** Don't ship a persona. Extract the *mechanisms* (relational framing, correction reception, cost asymmetry, cultural activation awareness) and encode them as moo infrastructure.

## Summary

| Learning | Priority | Fit with moo philosophy |
|---|---|---|
| Correction reception protocol in loop | High | Strong — process, not persona |
| Cost asymmetry framing in shape | High | Strong — extends existing feasibility logic |
| Relational frame in soul (lightweight) | Medium | Moderate — needs care to stay additive |
| Cultural activation awareness in skill language | Medium | Strong — improves existing mechanisms |
| Self-reinforcing language patterns | Low | Research — high potential, needs testing |
| Don't build a persona | N/A | Constraint — aligns with existing philosophy |

**The deepest takeaway:** moo's process discipline is necessary but may not be sufficient under pressure. humble-master shows that the default cultural activation of the coding assistant can override explicit instructions. The fix isn't a persona — it's ensuring moo's delivery mechanisms account for what they're delivering *into*: a model already primed to be confidently wrong about things it hasn't been told about.
