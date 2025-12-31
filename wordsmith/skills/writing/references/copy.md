# Microcopy Tones

Rewrite UI copy in multiple brand tones for comparison.

## Input Required

Ask for:

- **UI snippet:** The microcopy to rewrite (button text, error message, tooltip, etc.)
- **Three target tones:** e.g., "friendly", "premium", "playful"

## Tone Guidelines

Common tone spectrums:

| Tone         | Characteristics                                |
| ------------ | ---------------------------------------------- |
| Friendly     | Warm, approachable, uses "you", conversational |
| Premium      | Sophisticated, minimal, confident, no fluff    |
| Playful      | Fun, uses humor, emoji-friendly, energetic     |
| Professional | Clear, formal, trustworthy, no slang           |
| Urgent       | Action-oriented, time-sensitive, direct        |
| Reassuring   | Calm, supportive, addresses concerns           |

## Output Format

Return a markdown table:

| Tone     | Rewritten Copy (<=12 words) | Tone Choices (<=10 words) |
| -------- | --------------------------- | ------------------------- |
| [Tone 1] | [Rewrite]                   | [Why these word choices]  |
| [Tone 2] | [Rewrite]                   | [Why these word choices]  |
| [Tone 3] | [Rewrite]                   | [Why these word choices]  |

## Examples

**Original:** "Error: Invalid input"

| Tone     | Rewritten Copy                         | Tone Choices                         |
| -------- | -------------------------------------- | ------------------------------------ |
| Friendly | "Oops! That doesn't look quite right." | Softens error, conversational        |
| Premium  | "Please verify your entry."            | Minimal, respectful, no blame        |
| Playful  | "Hmm, something's off! Try again?"     | Light, encouraging, uses punctuation |

## Quality Checks

Before returning:

- [ ] Exactly 3 rows
- [ ] No row exceeds 12 words for copy
- [ ] Each rewrite matches the requested tone
- [ ] Comments explain specific word choices

## Rules

- Keep rewrites action-oriented where appropriate
- Preserve the original meaning
- Don't add information not in the original
- Use Ask tool if UI context is unclear
