---
name: writing
description: MANDATORY when user provides draft text, asks to edit prose, review writing, or improve copy. Auto-activates on "edit this", "improve this", "review my writing", "fix my prose", draft text in quotes, any content refinement, voice extraction, narrative structure, or microcopy tasks.
version: 0.0.3
---

# Writing Skill

Router skill for writing and content workflows. Detects task type and routes to appropriate workflow.

## When This Skill Activates

You're working on:

- Editing prose or documentation
- Extracting or matching author voice
- Structuring narratives or stories
- Writing UI microcopy
- Evaluating content quality

## Workflow Selection

Announce which workflow you're using:

| Task Type                                    | Workflow            | Reference                 |
| -------------------------------------------- | ------------------- | ------------------------- |
| Analyze writing style, extract voice profile | Voice Extraction    | `references/voice.md`     |
| Edit text, cut fluff, tighten prose          | Precision Editing   | `references/editing.md`   |
| Structure story, build narrative arc         | Narrative Structure | `references/narrative.md` |
| Write UI copy, tone variations               | Microcopy Tones     | `references/copy.md`      |
| Evaluate blog/content quality, score         | Content Evaluation  | `references/eval.md`      |

## Related Thinking Tools

From `hope/skills/soul/references/tools/`:

| Tool                                                                      | When to Use                                |
| ------------------------------------------------------------------------- | ------------------------------------------ |
| [Minto Pyramid](../../hope/skills/soul/references/tools/minto-pyramid.md) | Structure executive summaries, SCQA format |
| [Six Hats](../../hope/skills/soul/references/tools/six-hats.md)           | Multi-perspective content review           |

## Usage

1. Detect which workflow applies based on user's task
2. Announce: "I'm using the writing skill for [workflow]"
3. Load the appropriate reference file
4. Execute the workflow exactly as written

## Rules

- Use ask tool to gather input before proceeding
- Preserve author voice when editing
- Be specific about changes and rationale
- For evaluations, provide exact replacement text for fixes
