# product

Product management workflows for Claude Code.

## Install

```bash
/plugin install product@moo.md
```

## When It Activates

Auto-triggers on:
- Competitive analysis, market positioning
- PRD writing, requirements gathering
- Goal setting, metrics, OKRs
- User research synthesis
- Cohort and retention analysis
- Tech debt prioritization

## Commands

| Command | Purpose |
|---------|---------|
| `/product:prd` | Build PRD through interrogative requirements. Challenges assumptions, cuts scope to MVP. |
| `/product:prd-eval` | Score PRD on 5 dimensions. Returns ACCEPT/REVISE/REJECT with fixes. |
| `/product:compete` | Competitive analysis. Feature matrix, gap prioritization, win/loss patterns. |
| `/product:research` | Qualitative research synthesis. Emotional signals, tensions, emergent questions. |
| `/product:cohort` | Cohort analysis. Retention, LTV, churn patterns, strategic recommendations. |
| `/product:metrics` | Transform vague goals into SMART goals with tracking systems. |
| `/product:debt` | Tech debt prioritization. Business impact, effort estimates, remediation roadmap. |

## Quick Example

```
/product:prd "user authentication system for a SaaS app"
```

The system will:
1. Ask clarifying questions about scope
2. Challenge assumptions
3. Cut to MVP
4. Output structured PRD

→ Full docs: [`product/skills/product/SKILL.md`](../product/skills/product/SKILL.md)
