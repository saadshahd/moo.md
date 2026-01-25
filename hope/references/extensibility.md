# EXTEND.md Pattern

User and project-level skill customization without modifying source.

---

## Location Hierarchy

Extensions load in priority order:

| Priority | Location | Scope |
|----------|----------|-------|
| 1 (highest) | `.hope/<skill>/EXTEND.md` | Project-level |
| 2 (fallback) | `~/.hope/<skill>/EXTEND.md` | User-level |

Project-level overrides user-level.

---

## EXTEND.md Structure

```markdown
# Extension: [skill-name]

## Preferences
[Custom defaults for this skill]

## Custom Items
[User-defined styles, voices, or presets]

## Overrides
[Behavior modifications]
```

---

## First-Time Setup Flow

When a skill supports extension but none exists:

1. Skill detects missing EXTEND.md
2. Prompts: "Would you like to configure preferences for [skill]?"
3. If yes, asks questions via AskUserQuestion
4. Writes EXTEND.md with user's choices

---

## Example: Wordsmith Voice Extension

`.hope/wordsmith/EXTEND.md`:
```markdown
# Extension: wordsmith

## Preferences
- Default voice: technical-casual
- Max sentence length: 25 words
- Avoid: buzzwords, passive voice

## Custom Voices
### my-team-voice
- Tone: direct, collaborative
- Vocabulary: engineering terms OK
- Contractions: allowed
```

---

## Example: Counsel Expert Extension

`~/.hope/counsel/EXTEND.md`:
```markdown
# Extension: counsel

## Blocked Experts
- expert-123: Disagree with approach

## Custom Experts
### internal-architect
- Name: Sarah (Internal Architect)
- Specialty: Our system design
- Perspective: Pragmatic, shipping-focused
```

---

## What Can Be Extended

| Type | Examples |
|------|----------|
| Preferences | Default output format, verbosity |
| Styles/Voices | Custom writing voices |
| Templates | Modified output templates |
| Blocked items | Experts to skip, patterns to avoid |
| Custom items | User-defined presets |

---

## What Should NOT Be Extended

- Core skill logic (that's forking)
- Security boundaries
- Validation rules

---

## Skill Implementation

Skills supporting extension should:

1. Check for EXTEND.md in hierarchy
2. Merge extensions with defaults
3. Document extensible points in SKILL.md

```markdown
## Extensibility

This skill supports customization via EXTEND.md:
- `preferences.default_X`: Override default X
- `custom_Y`: Add user-defined Y
```

---

## Migration

When skill updates break extensions:

1. Skill detects incompatible EXTEND.md
2. Warns about deprecated fields
3. Suggests updates

---

*Based on Baoyu Skills patterns.*
