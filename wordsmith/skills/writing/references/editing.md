# Precision Editing

Cut the fluff, keep the voice. Edit prose for clarity without losing the author's style.

## Input Required

Ask for:
- Passage to edit
- Any constraints (word count target, tone to preserve)

## Editing Principles

1. **Cut unnecessary words** - Remove filler, redundancy, weak qualifiers
2. **Preserve author voice** - Don't impose your style
3. **Tighten argument** - Strengthen logical flow
4. **No content additions** - Only remove or restructure unless asked

## Common Cuts

| Pattern | Example | Fix |
|---------|---------|-----|
| Weak qualifiers | "very unique" | "unique" |
| Redundancy | "past history" | "history" |
| Filler phrases | "in order to" | "to" |
| Passive voice (when weak) | "was done by" | "[actor] did" |
| Hedge words | "I think that maybe" | Direct statement |
| Nominalizations | "make a decision" | "decide" |

## Output Format

Provide three sections:

### 1. Marked-Up Version

Show changes inline:
- ~~Strikethrough~~ for deletions
- **Bold** for additions or restructured text
- [Note: explanation] for non-obvious changes

### 2. Clean Final Version

The edited text without markup.

### 3. Edit Summary

```
## Edit Summary

- Original word count: [X]
- Final word count: [X]
- Reduction: [X]%

### Key Changes
1. [Change category]: [Brief explanation]
2. [Change category]: [Brief explanation]
3. [Change category]: [Brief explanation]
```

## Rules

- Show ALL changes in markup, not just major ones
- Explain non-obvious edits
- Preserve author's distinctive phrases and rhythms
- If voice is unclear, ask for more context
- Use ask tool if passage is ambiguous
