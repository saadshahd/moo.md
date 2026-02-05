---
name: writing
description: Precision editing for prose and copy. Use when user says "edit this", "improve this", "review my writing", "use [name]'s voice", or provides draft text to refine. Triggers on editing, voice extraction, voice library, narrative structure, microcopy.
model: sonnet
allowed-tools: Read
---

# Writing Skill

Router skill for writing and content workflows. Detects task type and routes to appropriate workflow.

## When This Skill Activates

- Editing prose or documentation
- Extracting or matching author voice
- Managing saved voice profiles (list, apply, delete)
- Structuring narratives or stories
- Writing UI microcopy
- Evaluating content quality

## Workflow Selection

Announce which workflow you're using:

| Task Type | Workflow |
|-----------|----------|
| Analyze writing style, extract voice profile | Voice Extraction |
| List, apply, or delete saved voices | Voice Library (`/wordsmith:voices`) |
| Edit text, cut fluff, tighten prose | Precision Editing |
| Structure story, build narrative arc | Narrative Structure |
| Write UI copy, tone variations | Microcopy Tones |
| Evaluate blog/content quality, score | Content Evaluation |
| Create RFC, ADR, design doc, or blog | Document Template (`../template/SKILL.md`) |

---

## Precision Editing

Ask for the passage and any constraints (word count target, tone to preserve).

**Principles:** Cut unnecessary words. Preserve author voice. Tighten argument flow. No content additions unless asked.

**Common cuts:** weak qualifiers (very, quite, rather), redundant pairs (past history, end result), filler phrases (in order to, due to the fact that), weak verbs (there is/are, make+noun), false transitions (however/moreover with no contrast), empty descriptors (interesting, significant — quantify or explain instead).

**Output three sections:**
1. **Marked-up** — ~~strikethrough~~ deletions, **bold** additions, [Note: reason] for non-obvious changes
2. **Clean final version**
3. **Edit summary** — original/final word count, reduction %, key changes

**Stop gate:** When improvement estimate drops below 5%, stop editing and ship. Max passes: internal docs 2, external copy 3, high-stakes 4. Substantive feedback or new requirements restart the cycle.

---

## Voice Extraction

Ask for 300-500 words of the author's writing and context (blog, docs, marketing, personal).

**Analyze five dimensions:**
- **Tone** — formal vs casual (1-10), serious vs playful, authoritative vs conversational
- **Cadence** — sentence length, paragraph rhythm, fragment/run-on patterns
- **Vocabulary** — jargon level, favorite phrases, avoided words
- **Syntax** — active/passive preference, question usage, structure patterns
- **Rhetorical moves** — openers, transitions, closings/CTAs

**Output JSON:** `style_profile` (all five dimensions), `voice_guideline` (140-160 word reusable guide), `demo_rewrite` (rewrite a neutral paragraph in extracted voice).

**Voice persistence:** After extraction, offer to save. Store in `~/.claude/learnings/voices.jsonl` with fields: ts, name, context, style_profile, voice_guideline, source_sample_hash. To load: match by name (case-insensitive, partial OK) from the same file.

---

## Narrative Structure

Ask for concept (one-line idea), target audience, and desired emotional outcome.

**Three-act structure:**
- **Act I Setup** — establish context, introduce protagonist, plant conflict seed
- **Act II Confrontation** — escalate tension, show stakes/obstacles, build to turning point
- **Act III Resolution** — deliver payoff, transform protagonist, call to action

**Output JSON:** `three_act_outline` (2 key beats per act), `opening_hook` (<=25 words, creates tension/curiosity), `closing_cta` (<=25 words, specific and actionable).

---

## Microcopy Tones

Ask for the UI snippet to rewrite and three target tones.

**Tone reference:** friendly (warm, "you", conversational), premium (minimal, confident, no fluff), playful (humor, emoji-friendly, energetic), professional (formal, trustworthy, no slang), urgent (action-oriented, time-sensitive), reassuring (calm, supportive).

**Output markdown table:** tone | rewritten copy (<=12 words) | tone choices (<=10 words explaining why). Preserve original meaning. Don't add information not in the original.

---

## Content Evaluation

Ask for content (paste or file path) and its goal.

**Score 0-5 on five axes:**

| Axis | 5 = strong | 0 = weak |
|------|-----------|----------|
| Specificity | 3+ concrete examples with names/numbers | Entirely generic claims |
| Proof density | Every claim backed by data/quotes/sources | All assertions, no backing |
| Positioning clarity | First paragraph names audience+problem+solution | Unclear who should care |
| Differentiation | Explicitly addresses alternatives with unique POV | Interchangeable with competitors |
| Call-to-action | Specific next step matching reader intent | No CTA or buried/vague |

**Verdict:** ACCEPT (>=4.2, <2 critical gaps), REVISE (3.0-4.1), REJECT (<3.0).

**Flag anti-patterns:** unproven superlatives ("best-in-class"), contextless metrics ("40% faster" — than what?), unnamed social proof, generic pain points, vague timeframes.

**Output JSON:** overall_score, axis_scores, verdict, critical_gaps[], top_fixes[] (priority, location, problem, current text, exact replacement, why).

---

## Open Loop Framework

Use the Zeigarnik effect to make messages stick. Answer first (state your point), bridge emotionally (connect to what they care about), then leave one thread open. Techniques: the cliff (stop mid-story), the question (end with curiosity), the gap (reveal incompleteness), the promise (defer the payoff). Avoid: too many open loops, fake cliffhangers, never closing any loops.

---

## Confirmation Gates

Multi-step workflows pause at checkpoints to prevent wasted work.

| Phase | Gate |
|-------|------|
| After voice/style analysis | "Does this capture the voice you want?" |
| After outline/structure | "Here's my proposed structure. Should I proceed?" |
| Before final output | "Ready to generate final version. Confirm?" |

Say "proceed without confirmation" to skip gates.

## Rules

- Use Ask tool to gather input before proceeding
- Preserve author voice when editing
- Be specific about changes and rationale
- For evaluations, provide exact replacement text for fixes

---

## Boundary

**Author's voice is sovereign. If edits feel foreign, reject them.**

- Claude preserves, never overwrites voice
- Suggestions are proposals, not corrections
- User decides what "better" means for their writing

Writing skill refines expression. It never changes what the author means to say.
