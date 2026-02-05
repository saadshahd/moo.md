---
name: skill-judge
description: Evaluate skill quality. Use when reviewing skills, before publishing, or auditing. Triggers on "evaluate skill", "skill quality", "audit skills".
model: opus
allowed-tools: Read, Glob
---

# skill-judge

Meta-skill for evaluating skill quality before publishing or during audits.

## When to Use

- Before publishing a new skill
- Reviewing a skill PR
- Auditing existing skills in batch
- Answering "is this skill worth it?"

---

## 8 Evaluation Dimensions

Score each 1-5. Read SKILL.md and all references before scoring.

| # | Dimension | Question |
| - | --------- | -------- |
| 1 | Clarity | Is the description trigger-only? WHAT + WHEN + KEYWORDS, no process summaries? |
| 2 | Completeness | Covers happy path, edge cases, and failure modes? |
| 3 | Tool Efficiency | Uses the right tools for the job? No unnecessary allowed-tools? |
| 4 | Decision Logic | Uses tables/DOT over prose for branching decisions? |
| 5 | Conciseness | SKILL.md under 200 lines? Details in references, not inline? |
| 6 | Testing | Eval cases exist in `<plugin>/eval/cases/`? |
| 7 | Calibration | Description matches actual trigger scenarios? Not too broad, not too narrow? |
| 8 | Flow | Easy to follow top-to-bottom? Progressive disclosure, scannable headings? |

### Knowledge Delta Gate

Before scoring, classify the skill:

- **[E]xpert** - Domain knowledge Claude lacks (ship-worthy)
- **[A]ctivation** - Knowledge Claude has but won't apply unprompted (ship-worthy)
- **[R]edundant** - Claude already does this well (reject)

If [R]edundant, stop evaluation. Recommend deletion or merge.

---

## Anti-Patterns (Key Signals)

- **Process in description** - Description contains workflow steps instead of trigger conditions. Claude follows the short description, skips the flowchart.
- **The Dump** - 400+ line SKILL.md with no references. Split and use progressive disclosure.
- **Reference chains** - Reference A requires Reference B. Each file must stand alone.
- **Generic warnings** - "Be careful" without specifics. Make actionable or delete.
- **Kitchen sink** - Skill tries to cover multiple unrelated purposes. Split into focused skills.

---

## Scoring and Verdict

```
## Dimension Scores

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Clarity | /5 | |
| Completeness | /5 | |
| Tool Efficiency | /5 | |
| Decision Logic | /5 | |
| Conciseness | /5 | |
| Testing | /5 | |
| Calibration | /5 | |
| Flow | /5 | |
| **Total** | **/40** | |
```

| Total | Verdict | Action |
| ----- | ------- | ------ |
| 0-15 | Rewrite | Fundamental issues, start over |
| 16-30 | Improve | Specific fixes needed before shipping |
| 31-40 | Ship | Good to publish, minor polish at most |

---

## Output Format

```
# Skill Evaluation: [skill-name]

## Summary
- Score: X/40 ([verdict])
- Knowledge Delta: [E/A/R] - [one-line justification]

## Dimension Scores
[Table from scoring section]

## Anti-Patterns Detected
[List with severity: critical / high / medium]

## Recommendations
1. [Highest priority fix]
2. [Second priority fix]
3. [Third priority fix]

## Verdict
[SHIP / IMPROVE / REWRITE / REJECT]
[One sentence justification]
```

For batch evaluation, output a summary table:

| Skill | Score | Delta | Top Issue | Verdict |
| ----- | ----- | ----- | --------- | ------- |
| skill-a | 35/40 | [A] | Minor description | SHIP |
| skill-b | 12/40 | [R] | Redundant | REJECT |

---

## Integration

After evaluation, recommend next steps using other skills:

| Finding | Invoke |
| ------- | ------ |
| Description fails Clarity/Calibration | Rewrite description with WHAT + WHEN + KEYWORDS pattern |
| Skill lacks structure or flow | `hope:shape` to restructure |
| Knowledge delta unclear | `hope:soul` to ground the skill's purpose |
| Eval cases missing | Add YAML cases to `<plugin>/eval/cases/` |

---

## Boundary

Evaluate skills only. For skill creation use `hope:shape`. For skill philosophy use `hope:soul`.
