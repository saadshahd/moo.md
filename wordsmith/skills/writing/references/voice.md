# Voice Extraction

Analyze writing samples to extract a reusable voice profile.

## Input Required

Ask for:
- 300-500 words of the author's writing
- Context: What type of content is this? (blog, docs, marketing, personal)

## Analysis Process

Build a style profile covering:

### Tone
- Formal vs casual spectrum (1-10)
- Serious vs playful
- Authoritative vs conversational

### Cadence
- Average sentence length
- Paragraph rhythm
- Use of fragments or run-ons

### Vocabulary
- Jargon level (technical terms, industry speak)
- Favorite words/phrases
- Words they avoid

### Syntax
- Active vs passive voice preference
- Question usage
- List and structure patterns

### Rhetorical Moves
- How they open pieces
- Transition patterns
- How they close/call to action

## Output Format

Return JSON:

```json
{
  "style_profile": {
    "tone": "[Description]",
    "cadence": "[Description]",
    "vocabulary": "[Description]",
    "syntax": "[Description]",
    "rhetorical_moves": "[Description]"
  },
  "voice_guideline": "[150-word reusable guide for matching this voice]",
  "demo_rewrite": "[Neutral paragraph rewritten in this voice]"
}
```

## Demo Paragraph

Use this neutral text for the demo rewrite:

> The product has been updated with new features. Users can now access additional functionality. The team worked on improvements based on feedback. More updates are planned for the future.

Rewrite this in the extracted voice to demonstrate the profile.

## Rules

- Voice guideline must be 140-160 words
- Demo rewrite must clearly show the extracted style
- Be specific about patterns, not vague ("uses short sentences" not "writes concisely")
- Use ask tool if sample is too short
