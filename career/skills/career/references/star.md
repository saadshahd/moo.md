# STAR-C Narrative Workflow

Transform bullet points into compelling behavioral interview stories using STAR-C format (Situation, Task, Action, Result, Constraint reflection).

## Input Required

Use Ask tool to gather:

1. **Experience bullet points or project descriptions** to transform
2. **Target role/level** (helps calibrate emphasis)
3. **Key competencies to highlight** (leadership, technical depth, collaboration, etc.)

## STAR-C Format

Each story must follow this structure:

### S - Situation Analysis

- Start with the hardest constraint faced
- Quantify the limitation (timeline, budget, resources, data availability)
- Explain why this constraint mattered strategically
- Set context for the stakes involved

### T - Task Definition

- Define success criteria with measurable outcomes
- Explain how success would be evaluated
- Identify who needed to be satisfied and why
- Clarify what failure would cost

### A - Action Documentation

- Focus on **decision points**, not just activities
- Explain reasoning at each choice point
- Highlight moments where approach A was chosen over B
- Include verification steps taken

### R - Result Quantification

- Provide specific metrics showing impact
- Compare to baseline or alternative approaches
- Include both intended and unintended consequences
- Measure efficiency gains and quality maintenance

### C - Constraint Reflection

- What would be done differently with more resources
- How the limitation shaped the approach
- What was learned about working within constraints
- How this learning applies to new situations

## Evidence Tagging

Tag each sentence in the narrative:

| Tag           | Meaning                             |
| ------------- | ----------------------------------- |
| `[FACT]`      | Directly verifiable claim           |
| `[INFERENCE]` | Reasonable conclusion from evidence |
| `[OPINION]`   | Your judgment or interpretation     |
| `[TK-VERIFY]` | Items to confirm before interview   |

## AI Integration Disclosure (When Relevant)

If AI tools were used, include:

- Specific tools for specific tasks
- Validation/verification process
- What AI got wrong and how it was caught
- Why human judgment was chosen over AI recommendation

## Transformation Process

### Step 1: Intake

Ask user to paste their bullet points or descriptions.

### Step 2: Identify Story Candidates

For each bullet, assess:

- Is there a clear constraint to anchor the story?
- Are there decision points (not just activities)?
- Can results be quantified?
- Does it demonstrate a target competency?

Prioritize stories with strong constraints and clear decision points.

### Step 3: Transform to STAR-C

For each viable story:

```
## [Story Title - Competency Demonstrated]

**SITUATION**
[FACT] [Opening with hardest constraint, quantified]
[FACT] [Why this constraint mattered strategically]
[INFERENCE] [Stakes involved]

**TASK**
[FACT] [Success criteria with measurable outcomes]
[FACT] [Who needed to be satisfied]
[INFERENCE] [Cost of failure]

**ACTION**
[FACT] [First decision point - what was chosen and why]
[FACT] [Second decision point - what was chosen over alternative]
[FACT] [Verification steps taken]
[OPINION] [Reasoning for approach]

**RESULT**
[FACT] [Primary metric achieved]
[FACT] [Comparison to baseline]
[INFERENCE] [Broader impact]

**CONSTRAINT REFLECTION**
[OPINION] [What would change with more resources]
[INFERENCE] [How limitation shaped approach]
[OPINION] [Learning that applies elsewhere]

---
**Evidence Strength:** X/5
**Recommended for:** [Interview type/competency]
**TK-VERIFY items:** [List anything to confirm]
```

## Example Transformation

**Input bullet:**

> "Led migration of customer data from legacy system under tight deadline"

**Output STAR-C:**

```
## 72-Hour Data Migration Under Contract Pressure - Technical Leadership

**SITUATION**
[FACT] We had 72 hours to migrate 15TB of customer data before our hosting contract expired.
[FACT] The legacy system had no API and limited export functionality—only manual CSV dumps of 10K records at a time.
[INFERENCE] A standard ETL approach would take 2+ weeks, which we didn't have.

**TASK**
[FACT] Success meant 100% data integrity with zero customer-facing downtime.
[FACT] Our CTO and three enterprise clients were monitoring hourly.
[INFERENCE] A failed migration would trigger $200K in contract penalties and likely lose two accounts.

**ACTION**
[FACT] I proposed parallel extraction using 8 simultaneous export streams, which our DBA initially rejected as too risky.
[FACT] I designed a checksum verification system that would catch any corruption before it reached production.
[FACT] I chose to run verification in real-time rather than batch (slower but caught issues immediately).
[OPINION] The real-time approach was worth the speed tradeoff because we couldn't afford to discover corruption at hour 71.

**RESULT**
[FACT] Completed migration in 68 hours with 100% data integrity verified.
[FACT] Zero customer-reported issues post-migration.
[INFERENCE] The parallel approach became our standard for subsequent migrations, cutting typical migration time by 60%.

**CONSTRAINT REFLECTION**
[OPINION] With more time, I'd have built an automated rollback system rather than relying on manual snapshots.
[INFERENCE] The tight deadline forced creative parallelization I wouldn't have considered otherwise.
[OPINION] I now always ask "what's the parallel path?" when facing timeline pressure.

---
**Evidence Strength:** 4/5
**Recommended for:** Technical interviews, leadership interviews, "tell me about a challenging deadline" questions
**TK-VERIFY items:** Exact data volume, precise timeline, contract penalty amount
```

## Output Format

Deliver stories grouped by:

1. Target competencies they demonstrate
2. Evidence strength (prioritize 4-5/5)
3. TK-VERIFY items across all stories

## Rules

- Constraints are the anchor—no constraint, no story
- Decision points > activities (what was chosen, not just done)
- Quantify everything that can be quantified
- Tag every sentence for interview preparation
- Be honest about evidence strength—weak stories should be flagged
