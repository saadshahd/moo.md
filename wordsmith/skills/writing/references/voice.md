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

---

## Voice Persistence

After extracting a voice profile, offer to save it for reuse.

### Save Voice

Ask for a name to identify this voice, then append to library:

```bash
mkdir -p ~/.claude/learnings
```

**JSONL schema for `~/.claude/learnings/voices.jsonl`:**

```json
{
  "ts": "2024-01-15T10:30:00Z",
  "name": "author_name_or_identifier",
  "context": "blog|docs|marketing|personal",
  "style_profile": { "tone": "...", "cadence": "...", "vocabulary": "...", "syntax": "...", "rhetorical_moves": "..." },
  "voice_guideline": "150-word guide...",
  "source_sample_hash": "first_50_chars_of_sample"
}
```

### Load Voice

When user asks to "write like [name]" or "use [name]'s voice":

1. Read `~/.claude/learnings/voices.jsonl`
2. Match by name (case-insensitive, partial match OK)
3. If found, display `voice_guideline` and apply to subsequent writing
4. If not found, offer to extract from new sample

### Prompt After Extraction

After outputting the extracted profile:

> Save this voice profile? Provide a name to save it for reuse, or skip to continue without saving.

See `/wordsmith:voices` command for listing, applying, and deleting saved voices.
