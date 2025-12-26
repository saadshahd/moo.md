---
description: List, apply, or delete saved voice profiles. Use when user wants to see available voices or apply a saved voice to writing.
---

# /wordsmith:voices

Manage saved voice profiles.

## Usage

```
/wordsmith:voices              # List all saved voices
/wordsmith:voices apply "name" # Apply voice to current writing task
/wordsmith:voices delete "name" # Remove a saved voice
```

## Process

### List Voices

Read `~/.claude/learnings/voices.jsonl` and display as table:

| Name | Context | Saved | Key Traits |
|------|---------|-------|------------|
| [name] | [context] | [date] | [First 50 chars of voice_guideline] |

If file doesn't exist or is empty: "No saved voices. Use voice extraction to create one."

### Apply Voice

1. Parse `~/.claude/learnings/voices.jsonl`
2. Match by name (case-insensitive, partial match with confirmation)
3. Display the full `voice_guideline`
4. Confirm: "Applying [name]'s voice to subsequent writing in this conversation."
5. Use the guideline for all text generation until session ends or voice is changed

If no match: "No voice named '[name]' found. Available voices: [list names]"

### Delete Voice

1. Read all entries from `~/.claude/learnings/voices.jsonl`
2. Find matching name (case-insensitive)
3. Confirm: "Delete voice '[name]'? This cannot be undone."
4. If confirmed, filter out matching entry and write remaining entries back
5. Report: "Deleted voice '[name]'. [N] voices remaining."

If no match: "No voice named '[name]' found."

## Constraints

- Voice names should be unique (warn on duplicate during save)
- Partial matching: "saad" matches "Saad's Blog Voice"
- Always confirm before delete
- Display voice count after list/delete operations

## File Location

Voices stored at: `~/.claude/learnings/voices.jsonl`

One JSON object per line, same schema as voice extraction output.
