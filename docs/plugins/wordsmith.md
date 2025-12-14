# wordsmith — Power User Reference

Writing and content workflows for Claude Code.

---

| Say this                      | Get this                       |
| ----------------------------- | ------------------------------ |
| "edit this: [text]"           | Marked-up edit + clean version |
| "extract voice from this"     | Reusable voice profile         |
| "structure a narrative for X" | 3-act story with beats         |
| "write this in 3 tones"       | UI copy variations             |
| "is this ready to publish?"   | Quality score + verdict        |

---

## Install

```bash
/plugin install wordsmith@moo.md
```

## When It Activates

Auto-triggers on:

- "edit this", "improve this", "fix my prose"
- Draft text in quotes
- Voice extraction requests
- Narrative structure tasks
- UI microcopy writing
- Content quality evaluation

## Commands

| Command                | Purpose                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| `/wordsmith:edit`      | Precision editing. Cut fluff, preserve voice, show markup and clean version.    |
| `/wordsmith:voice`     | Extract voice profile from writing sample. Tone, cadence, vocabulary, patterns. |
| `/wordsmith:narrative` | Build 3-act story structure. Opening hook, key beats, closing CTA.              |
| `/wordsmith:copy`      | Rewrite UI microcopy in 3 brand tones with comparison table.                    |
| `/wordsmith:blog-eval` | Score content on 5 dimensions. Returns ACCEPT/REVISE/REJECT with fixes.         |

## Precision Editing

The `/wordsmith:edit` command follows these principles:

1. **Cut unnecessary words** — Filler, redundancy, weak qualifiers
2. **Preserve author voice** — Don't impose a different style
3. **Tighten argument** — Strengthen logical flow
4. **No content additions** — Only remove or restructure

### Common Cuts

| Pattern         | Before               | After            |
| --------------- | -------------------- | ---------------- |
| Weak qualifiers | "very unique"        | "unique"         |
| Redundancy      | "past history"       | "history"        |
| Filler phrases  | "in order to"        | "to"             |
| Passive voice   | "was done by"        | "[actor] did"    |
| Hedge words     | "I think that maybe" | Direct statement |
| Nominalizations | "make a decision"    | "decide"         |

### Output Format

1. **Marked-Up Version** — Strikethroughs for deletions, bold for additions
2. **Clean Final Version** — Edited text without markup
3. **Edit Summary** — Word count reduction, key changes

## Voice Extraction

The `/wordsmith:voice` command analyzes 300-500 words and extracts:

| Dimension        | What it captures                                             |
| ---------------- | ------------------------------------------------------------ |
| Tone             | Formal/casual, serious/playful, authoritative/conversational |
| Cadence          | Sentence length, paragraph rhythm, fragments                 |
| Vocabulary       | Jargon level, favorite phrases, avoided words                |
| Syntax           | Active/passive preference, question usage, list patterns     |
| Rhetorical moves | How they open, transition, close                             |

### Output

Returns JSON with:

- `style_profile` — Detailed analysis of each dimension
- `voice_guideline` — 150-word reusable guide for matching this voice
- `demo_rewrite` — Neutral paragraph rewritten in the extracted voice

## Narrative Structure

The `/wordsmith:narrative` command builds:

1. **Opening hook** — First line that grabs attention
2. **Act 1: Setup** — Establish stakes and context
3. **Act 2: Tension** — Build conflict or challenge
4. **Act 3: Resolution** — Payoff and transformation
5. **Closing CTA** — What audience should do next

Works for: talks, blog posts, product stories, case studies.

## UI Microcopy

The `/wordsmith:copy` command takes UI text and rewrites in 3 brand tones:

| Tone         | Character                     |
| ------------ | ----------------------------- |
| Professional | Clean, trustworthy, corporate |
| Friendly     | Warm, approachable, human     |
| Bold         | Confident, punchy, memorable  |

Output: Comparison table with original + 3 variations.

## Content Evaluation

The `/wordsmith:blog-eval` command scores on 5 dimensions (0-5 each):

| Dimension | What it measures                        |
| --------- | --------------------------------------- |
| Clarity   | Easy to understand, no jargon confusion |
| Structure | Logical flow, clear sections            |
| Voice     | Consistent tone, author personality     |
| Value     | Teaches something, solves a problem     |
| Hook      | Opening grabs attention, ending lands   |

**Verdict:** ACCEPT (≥20), REVISE (15-19), REJECT (<15)

For each issue, provides exact replacement text.

---

→ Source: [`wordsmith/skills/writing/SKILL.md`](../../wordsmith/skills/writing/SKILL.md)
