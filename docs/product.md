# product — Power User Reference

Product management workflows for Claude Code.

---

| Say this | Get this |
|----------|----------|
| "write a PRD for X" | Interrogative requirements gathering |
| "analyze competitors for X" | Feature matrix + gap analysis |
| "prioritize tech debt" | Business impact + remediation roadmap |
| "synthesize this research" | Emotional signals + emergent themes |
| "define metrics for X" | SMART goals + tracking system |

---

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
| `/product:prd-eval` | Score PRD on 5 dimensions (0-5 each). Returns ACCEPT/REVISE/REJECT with fixes. |
| `/product:compete` | Competitive analysis. Feature matrix, gap prioritization, win/loss patterns, roadmap. |
| `/product:research` | Qualitative research synthesis. Emotional signals, tensions, emergent questions. |
| `/product:cohort` | Cohort analysis. Retention, LTV, churn patterns, strategic recommendations. |
| `/product:metrics` | Transform vague goals into SMART goals with tracking systems. |
| `/product:debt` | Tech debt prioritization. Business impact, effort estimates, remediation roadmap. |

## PRD Workflow

The `/product:prd` command follows four phases:

1. **Context Dump** — Accept messy notes about the project
2. **Interrogate** — Challenge assumptions across 6 areas:
   - Vision & Validation
   - Users & Use Cases
   - Features & Scope
   - Technical Requirements
   - Success Metrics
   - Risks & Assumptions
3. **Challenge** — "Defend why each remaining feature must be included"
4. **Generate** — Structured PRD after user confirms

**Key discipline:** "Can we ship without this feature?" — Default to cutting scope.

## Competitive Analysis Workflow

The `/product:compete` command produces:

1. **Landscape Overview** — Position each competitor (Leader/Challenger/Niche)
2. **Feature Matrix** — Gap analysis with status indicators (✅/🟡/❌/🚧)
3. **Strategic Gaps** — Top 5 gaps with build/buy/partner analysis
4. **Win/Loss Patterns** — Why you win, why you lose (with evidence)
5. **Roadmap Recommendations** — Prioritized by impact score

**Priority formula:**
```
Priority = (Market Pressure × Deal Impact × Strategic Fit) / Build Effort
```

## PRD Evaluation Scoring

The `/product:prd-eval` command scores on 5 dimensions (0-5 each):

| Dimension | What it measures |
|-----------|------------------|
| Clarity | Unambiguous language, clear success criteria |
| MVP Focus | Scope cuts, feature justification |
| Feasibility | Technical realism, constraint awareness |
| Completeness | All sections present, no gaps |
| Risk Management | Risks identified with mitigations |

**Verdict:** ACCEPT (≥20), REVISE (15-19), REJECT (<15)

## Research Synthesis

The `/product:research` command iteratively extracts:

- **Emotional signals** — What users feel, not just what they say
- **Tensions** — Contradictions between stated needs and behavior
- **Emergent themes** — Patterns across interviews
- **Follow-up questions** — What to explore next

## Cohort Analysis

The `/product:cohort` command analyzes:

| Output | What it shows |
|--------|---------------|
| Retention matrix | Week-over-week retention by cohort |
| LTV by cohort | Lifetime value trends |
| Churn patterns | When and why users leave |
| Recommendations | Strategic actions based on data |

## Tech Debt Prioritization

The `/product:debt` command produces:

1. **Tier classification** — Critical/High/Medium/Low
2. **Business impact** — How debt affects revenue/velocity
3. **Effort estimates** — Story points per item
4. **Sprint allocation** — How much capacity to dedicate
5. **Remediation roadmap** — Phased approach

---

→ Source: [`product/skills/product/SKILL.md`](../product/skills/product/SKILL.md)
