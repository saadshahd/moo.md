# wordsmith

Writing and content workflows for Claude Code.

## Install

```bash
/plugin install wordsmith@moo.md
```

## When It Activates

Auto-triggers on:
- Editing prose or documentation
- Extracting author voice profiles
- Structuring narratives
- Writing UI microcopy
- Evaluating content quality

## Commands

| Command | Purpose |
|---------|---------|
| `/wordsmith:voice` | Extract voice profile from writing sample. Tone, cadence, vocabulary, rhetorical patterns. |
| `/wordsmith:edit` | Precision editing. Cut fluff, preserve voice, show markup and clean version. |
| `/wordsmith:narrative` | Build 3-act story structure. Opening hook, key beats, closing CTA. |
| `/wordsmith:copy` | Rewrite UI microcopy in 3 brand tones with comparison table. |
| `/wordsmith:blog-eval` | Score content on 5 dimensions. Returns ACCEPT/REVISE/REJECT with fixes. |

## Quick Example

```
/wordsmith:edit "paste your passage here"
```

The system will:
1. Show marked-up version with strikethroughs and additions
2. Provide clean final version
3. Summarize word count reduction and key changes

→ Full docs: [`wordsmith/skills/writing/SKILL.md`](../wordsmith/skills/writing/SKILL.md)
