# Skill Anti-Patterns

9 failure patterns to detect and fix.

## 1. The Tutorial

Teaching basics Claude already knows.

### Signals

- Explains fundamental concepts
- "What is X" sections
- Definitions Claude was trained on
- Step-by-step for common tasks

### Example

```markdown
## What is Code Review?
Code review is the process of examining code changes...

## Why Review Code?
Code review helps catch bugs...
```

### Why It Fails

Claude knows what code review is. Teaching wastes tokens and doesn't add delta.

### Fix

Delete tutorial content. Jump to [E]xpert or [A]ctivation knowledge directly.

---

## 2. The Dump

800+ lines with no progressive disclosure.

### Signals

- SKILL.md over 400 lines
- No references directory
- Long prose paragraphs
- Everything at same depth

### Example

```markdown
# skill-name

[400 lines of detailed instructions]
[200 lines of examples]
[150 lines of edge cases]
[50 lines of anti-patterns]
```

### Why It Fails

Overwhelms context. Claude can't prioritize. Key information buried.

### Fix

1. SKILL.md: 150-200 lines, overview only
2. References: Deep details in separate files
3. Tables: Replace paragraphs
4. Progressive disclosure: Surface → Details

---

## 3. The Invisible Skill

Poor description = never triggered.

### Signals

- Description lacks WHEN triggers
- No KEYWORDS users actually say
- Vague WHAT statement
- Multi-line YAML blocks (truncated by Claude Code)

### Example

```yaml
---
name: my-skill
description: A comprehensive skill for handling various aspects of software development
---
```

### Why It Fails

Claude can't match user requests to skill. Skill never activates.

### Fix

Rewrite description with template:
```
[WHAT in one sentence]. Use when [WHEN triggers]. Triggers on "[KEYWORD 1]", "[KEYWORD 2]", "[KEYWORD 3]".
```

---

## 4. The Freedom Mismatch

Wrong constraint level for task nature.

### Over-Constrained Example

```markdown
# creative-writing

## Format Requirements
- Exactly 3 paragraphs
- First paragraph: 50-60 words
- Second paragraph: 80-90 words
- Use exactly 2 metaphors per paragraph
```

### Under-Constrained Example

```markdown
# api-response-format

Just format the API response appropriately.
```

### Why It Fails

Over-constrained: Kills creativity, outputs feel robotic.
Under-constrained: Inconsistent outputs, user frustration.

### Fix

Match to design pattern:
- Creative → Mindset (high freedom)
- Precise → Tool (low freedom)
- Judgment → Philosophy (medium freedom)

---

## 5. Reference Chains

A requires B requires C.

### Signals

- Reference file says "see [other reference]"
- Understanding one file requires loading another
- Circular dependencies between references
- Deep nesting in references

### Example

```markdown
# references/step-1.md
For details on validation, see step-2.md

# references/step-2.md
After validation, proceed to step-3.md

# references/step-3.md
If errors found, return to step-1.md
```

### Why It Fails

Each file should be self-contained. Chains break understanding and increase token cost.

### Fix

Flatten. Each reference must stand alone. Exception: intra-plugin sharing (e.g., trace using soul/references/blameless.md).

---

## 6. Generic Warnings

"Be careful" without specifics.

### Signals

- "Consider" without criteria
- "Be aware" without examples
- "Avoid mistakes" without listing them
- Vague cautionary language

### Example

```markdown
## Cautions
- Be careful with edge cases
- Consider the implications
- Avoid common pitfalls
- Keep security in mind
```

### Why It Fails

No actionable guidance. Claude can't act on "be careful."

### Fix

Make specific or delete:

```markdown
## Edge Cases
| Case | Failure | Prevention |
| ---- | ------- | ---------- |
| Empty input | Crashes | Check length first |
| Unicode | Encoding error | Normalize to UTF-8 |
```

---

## 7. Over-Engineering

Unnecessary per-skill infrastructure.

### Signals

- README.md in skill directory
- CHANGELOG.md per skill
- VERSION file per skill
- Duplicate metadata
- Test files in skill directory

### Example

```
skills/my-skill/
├── SKILL.md
├── README.md          ← unnecessary
├── CHANGELOG.md       ← unnecessary
├── VERSION            ← unnecessary
└── references/
```

### Why It Fails

- Version lives in plugin.json (DRY)
- Docs live in /docs
- Tests live in /eval
- Per-skill duplication = maintenance burden

### Fix

```
skills/my-skill/
├── SKILL.md
└── references/
```

One plugin.json for version. Shared docs.

---

## 8. The Monologue

All instructions, no structure.

### Signals

- Long paragraphs
- No tables
- No code blocks
- No bullet points
- Wall of text

### Example

```markdown
When evaluating a skill, you should first consider whether the problem is well-defined.
A well-defined problem is one where the boundaries are clear and the scope is limited.
If the problem is not well-defined, you should work with the user to clarify it before
proceeding. Once the problem is defined, you should then assess the knowledge delta...
```

### Why It Fails

Hard to scan. Can't find specific guidance. Information lost in prose.

### Fix

Convert to structured elements:

| Element | Use For |
| ------- | ------- |
| Tables | Comparisons, criteria, mappings |
| Bullets | Lists, options, steps |
| Code blocks | Templates, formats, examples |
| Headers | Sections, hierarchy |

---

## 9. The Kitchen Sink

Tries to do everything.

### Signals

- Skill description has multiple distinct purposes
- "Also handles X, Y, and Z"
- 500+ lines covering unrelated topics
- Would trigger on many different requests

### Example

```markdown
# general-helper

This skill helps with:
- Code review
- Writing documentation
- Debugging
- Architecture decisions
- Testing strategies
- Performance optimization
- Security review
```

### Why It Fails

- Jack of all trades, master of none
- Description too vague to trigger correctly
- Token cost for irrelevant sections
- Conflicts with specialized skills

### Fix

Split into focused skills:

```
general-helper → delete

Instead:
- code-review (focused)
- debug (focused, or use existing)
- security-review (focused)
```

---

## Anti-Pattern Detection Checklist

When evaluating a skill, check each:

| # | Anti-Pattern | Check |
| - | ------------ | ----- |
| 1 | Tutorial | Does it teach basics Claude knows? |
| 2 | Dump | Is SKILL.md > 400 lines? |
| 3 | Invisible | Is description missing WHAT/WHEN/KEYWORDS? |
| 4 | Freedom Mismatch | Do constraints match task type? |
| 5 | Reference Chains | Do references require other references? |
| 6 | Generic Warnings | Are cautions specific and actionable? |
| 7 | Over-Engineering | Is there unnecessary infrastructure? |
| 8 | Monologue | Is content structured (tables, bullets)? |
| 9 | Kitchen Sink | Does skill have one clear purpose? |

## Severity Levels

| Severity | Anti-Patterns | Action |
| -------- | ------------- | ------ |
| Critical | 3 (Invisible), 9 (Kitchen Sink) | Cannot ship |
| High | 1 (Tutorial), 2 (Dump), 4 (Mismatch) | Revise before ship |
| Medium | 5 (Chains), 6 (Generic), 8 (Monologue) | Should fix |
| Low | 7 (Over-Engineering) | Nice to fix |
