# SCOPE

Right-size analysis work before starting—avoid wrong inputs, scope creep, and unclear success.

## When to Use

| Trigger | Use This Framework |
|---------|-------------------|
| Starting research or analysis | Define boundaries first |
| Unclear what question to answer | Clarify before diving in |
| Past projects went off-track | Prevent scope issues upfront |

## The Framework

```
    ┌─────────────────────────────────────────────────────┐
    │                     SCOPE                           │
    │        Pre-analysis setup for right-sized work      │
    └─────────────────────────────────────────────────────┘

    ┌─────────────┐
    │ S-SITUATE   │  What's the context? What triggered this?
    │             │
    │ Current     │  ─▶ Background, stakeholders, constraints
    │ state       │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ C-CLARIFY   │  What's the actual question/need?
    │             │
    │ Real        │  ─▶ The ONE question to answer
    │ question    │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ O-OUTLINE   │  What does "done" look like?
    │             │
    │ Success     │  ─▶ Specific deliverable, format, depth
    │ criteria    │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ P-PREREQS   │  What will I wish I had halfway through?
    │             │
    │ Input       │  ─▶ Data, access, context, expertise
    │ validation  │      (Pre-mortem thinking)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ E-EDGES     │  What's in scope? What's out?
    │             │
    │ Boundaries  │  ─▶ Explicit inclusions/exclusions
    │             │      Is this too big?
    └─────────────┘
```

## How to Apply

### S - Situate

Answer: What's the context?

- What triggered this request?
- Who are the stakeholders?
- What decisions will this inform?
- What's the timeline/urgency?

### C - Clarify

Answer: What's the real question?

- Restate in your own words
- Is this the right question, or a symptom?
- Would answering this actually help?

**Test:** If I answer X, will that unlock the next step? If not, find the real question.

### O - Outline

Answer: What does "done" look like?

- Specific deliverable format (report? slide? number?)
- Required depth (directional? precise?)
- Who consumes this and how?

**Test:** Could I recognize "done" if I saw it?

### P - Prerequisites (Pre-mortem)

Answer: What will I wish I had halfway through?

Run a mental pre-mortem:
- What data do I need access to?
- What context am I missing?
- Who should I talk to first?
- What assumptions am I making?

**Test:** If I start now and get stuck, what will have stopped me?

### E - Edges

Answer: What's in and out of scope?

| In Scope | Out of Scope |
|----------|--------------|
| [explicit] | [explicit] |

**Calibration check:**
- If scope is huge: What's the minimum viable version?
- If scope is tiny: Am I missing important context?

## Example

**Topic:** Analyze customer churn

```
S - SITUATE
─────────────────────────────────────────────────
- Triggered by: Q3 churn spike (15% → 22%)
- Stakeholders: VP Product (decision maker), CS team
- Timeline: Need initial findings by Friday
- Decision: Where to focus retention efforts

C - CLARIFY
─────────────────────────────────────────────────
Surface question: "Why are customers churning?"
Real question: "Which churn cohort is fixable, and what
               would fix it?"

(The first question leads to analysis paralysis.
 The second leads to action.)

O - OUTLINE
─────────────────────────────────────────────────
Deliverable: 1-page brief with:
- Top 3 churn cohorts by volume
- Fixability score for each (high/med/low)
- One recommended intervention per cohort

P - PREREQUISITES
─────────────────────────────────────────────────
Pre-mortem: "Halfway through, I'll wish I had..."
- Exit survey data (need to request from CS)
- Product usage patterns 30 days pre-churn
- Comparison data from Q2 (before the spike)
- Definition of "churned" (need to confirm)

E - EDGES
─────────────────────────────────────────────────
| In Scope              | Out of Scope           |
|-----------------------|------------------------|
| Q3 churn analysis     | Historical trends      |
| B2B customers         | B2C / consumer         |
| Top 3 cohorts only    | Exhaustive root cause  |
| Recommendation brief  | Implementation plan    |

Calibration: Scope is tight. Good for Friday deadline.
```

## Anti-Patterns

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Skip to analysis | Wrong inputs discovered late | Run SCOPE first |
| Vague success criteria | "Done" becomes moving target | Force specificity in O |
| Assume data exists | Blocked waiting for access | Pre-mortem in P |
| Scope creep mid-project | Never finish | Refer back to E |

## Key Insight

The work you do before you start determines whether the work you do will matter. Ten minutes of scoping saves ten hours of rework.
