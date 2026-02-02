---
name: skill-judge
description: Evaluate skill quality using 8-dimension framework. Use when reviewing skills, before publishing, or auditing existing skills. Triggers on "evaluate skill", "review skill", "skill quality", "audit skills".
model: opus
allowed-tools: Read, Glob
---

# skill-judge

Meta-skill for evaluating skill quality before publishing or during audits.

## When to Use

| Trigger | Action |
| ------- | ------ |
| Before publishing new skill | Run full evaluation |
| Reviewing skill PR | Run full evaluation |
| Auditing existing skills | Batch evaluation |
| "Is this skill worth it?" | Run Knowledge Delta check |

## Quick Assessment

Before deep evaluation, answer:

1. **Does Claude already do this well?** If yes, skill is likely [R]edundant
2. **Would a 3-line prompt achieve the same?** If yes, too little delta
3. **Is the problem actually bounded?** If no, redesign first

## Evaluation Framework (120 points)

| Dimension | Points | Question |
| --------- | ------ | -------- |
| Problem Definition | 15 | Is the problem clear and bounded? |
| Knowledge Delta | 20 | Does it add [E]xpert or [A]ctivation knowledge? |
| Description Quality | 15 | WHAT + WHEN + KEYWORDS present? |
| Progressive Disclosure | 15 | Right level of detail per section? |
| Freedom Calibration | 15 | Constraints match task nature? |
| Output Format | 10 | Clear templates/structure? |
| Anti-Pattern Coverage | 15 | Common mistakes addressed? |
| Testability | 15 | Can we verify it works? |

**Scoring guide:** See [evaluation-dimensions.md](references/evaluation-dimensions.md)

## Score Interpretation

| Score | Verdict | Action |
| ----- | ------- | ------ |
| 100-120 | Excellent | Ship |
| 80-99 | Good | Ship with minor tweaks |
| 60-79 | Needs work | Revise before publishing |
| 40-59 | Significant issues | Major redesign needed |
| < 40 | Fundamental problems | Reconsider if skill is needed |

## Knowledge Delta Classification

Every skill must justify its existence via knowledge delta.

| Type | Symbol | Definition | Example |
| ---- | ------ | ---------- | ------- |
| Expert | [E] | Domain expertise Claude lacks | Security threat models, industry-specific regulations |
| Activation | [A] | Knowledge Claude has but needs prompting | Structured frameworks, systematic checklists |
| Redundant | [R] | Already in Claude's base capabilities | Basic coding patterns, general writing |

**Minimum bar:** Skill must be [E] or [A]. Reject [R] skills.

See [knowledge-delta.md](references/knowledge-delta.md) for detailed guidance.

## Description Validation

Descriptions are the skill's resume. Bad description = never activated.

### Required Elements (All 3)

| Element | Check | Example |
| ------- | ----- | ------- |
| WHAT | Single sentence explaining purpose | "Evaluate skill quality using 8-dimension framework" |
| WHEN | Explicit trigger conditions | "Use when reviewing skills, before publishing" |
| KEYWORDS | Trigger phrases users actually say | "evaluate skill", "skill quality", "audit skills" |

### Anti-Patterns

```
WRONG: "Helps with skills"
  - Vague WHAT, no WHEN, no KEYWORDS

WRONG: "Use this skill to evaluate the quality of skills using various criteria"
  - No WHEN trigger, no KEYWORDS

RIGHT: "Evaluate skill quality using 8-dimension framework. Use when
reviewing skills, before publishing, or auditing existing skills.
Triggers on 'evaluate skill', 'review skill', 'skill quality'."
  - WHAT + WHEN + KEYWORDS all present
```

## Design Pattern Selection

Match skill pattern to task nature.

| Pattern | Lines | Freedom | Use When |
| ------- | ----- | ------- | -------- |
| Mindset | ~50 | High | Creative/taste tasks |
| Navigation | ~30 | Varies | Routing between scenarios |
| Philosophy | ~150 | Medium | Deep thinking + craft |
| Process | ~200 | Low | Multi-step workflows |
| Tool | ~300 | Very Low | Precise operations |

See [design-patterns.md](references/design-patterns.md) for detailed guidance.

## Anti-Patterns to Detect

| # | Pattern | Signal | Fix |
| - | ------- | ------ | --- |
| 1 | The Tutorial | Teaching basics | Delete, Claude knows this |
| 2 | The Dump | 800+ lines, no structure | Split + progressive disclosure |
| 3 | The Invisible Skill | Poor description | Rewrite with WHAT/WHEN/KEYWORDS |
| 4 | The Freedom Mismatch | Wrong constraint level | Match pattern to task |
| 5 | Reference Chains | A → B → C | Flatten, no chains |
| 6 | Generic Warnings | "Be careful" | Specific guidance or delete |
| 7 | Over-Engineering | README per skill | One plugin.json, shared docs |
| 8 | The Monologue | All prose, no tables | Add structure, tables, bullets |
| 9 | The Kitchen Sink | Tries everything | Scope to one clear purpose |

See [anti-patterns.md](references/anti-patterns.md) for detailed examples.

## Evaluation Process

### 1. Read the Skill

Load SKILL.md and all referenced files.

### 2. Score Each Dimension

```
## Dimension Scores

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | /15 | |
| Knowledge Delta | /20 | [E/A/R] |
| Description Quality | /15 | |
| Progressive Disclosure | /15 | |
| Freedom Calibration | /15 | |
| Output Format | /10 | |
| Anti-Pattern Coverage | /15 | |
| Testability | /15 | |
| **Total** | **/120** | |
```

### 3. Classify Knowledge Delta

State clearly: `[E]xpert`, `[A]ctivation`, or `[R]edundant`

If [R]edundant: recommend deletion or merge.

### 4. Check Description

```
□ WHAT present (single sentence purpose)
□ WHEN present (trigger conditions)
□ KEYWORDS present (actual trigger phrases)
□ Under 1024 characters
□ No multi-line YAML blocks
```

### 5. Identify Anti-Patterns

List any detected from the 9 patterns.

### 6. Recommend Pattern

Based on task nature, recommend appropriate design pattern.

### 7. Provide Actionable Feedback

For each issue found:
- Location (file:line or section)
- Problem (specific, not vague)
- Fix (concrete suggestion)

## Output Format

```
# Skill Evaluation: [skill-name]

## Summary
- Score: X/120 ([verdict])
- Knowledge Delta: [E/A/R] - [brief justification]
- Pattern Match: [current] → [recommended if different]

## Dimension Scores
[Table from step 2]

## Description Analysis
[Checklist from step 4]
[Specific issues if any]

## Anti-Patterns Detected
[List with severity]

## Recommendations
1. [Highest priority fix]
2. [Second priority fix]
3. [Third priority fix]

## Verdict
[SHIP / REVISE / REDESIGN / REJECT]
[One sentence justification]
```

## Batch Evaluation

When auditing multiple skills:

```
## Plugin Audit: [plugin-name]

| Skill | Score | Delta | Top Issue | Verdict |
| ----- | ----- | ----- | --------- | ------- |
| skill-a | 95/120 | [A] | Minor description | SHIP |
| skill-b | 62/120 | [R] | Redundant | REJECT |
| skill-c | 78/120 | [E] | Missing anti-patterns | REVISE |

### Priority Fixes
1. [skill-b]: Delete or merge (redundant)
2. [skill-c]: Add anti-pattern section
```

## Common Rationalizations (All Wrong)

| Thought | Reality |
| ------- | ------- |
| "More is better" | Longer skills = more confusion, not more value |
| "Claude needs to be told everything" | Claude knows most things. Add delta only. |
| "The description is fine" | If not triggering, description is the problem |
| "Users will read the whole skill" | They won't. Progressive disclosure matters. |
| "This edge case might happen" | YAGNI. Add only what's proven needed. |
