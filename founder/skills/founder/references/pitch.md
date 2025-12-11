# Build Pitch Deck

Create a complete Marp pitch deck and ruthlessly evaluate it against YC standards.

## Input Required

Ask for (if not provided):

- Product name and one-liner
- Product category
- Current traction (users, revenue, growth rate)
- Team background (brief)
- Funding ask (if any)

## Phase 1: Deck Structure

Plan 10-12 slides with narrative flow:

| #   | Slide          | Key Points (2-3)                           | Transition                  | Time |
| --- | -------------- | ------------------------------------------ | --------------------------- | ---- |
| 1   | Title          | Company name, tagline, your name           | Hook the problem            | 15s  |
| 2   | Problem        | Pain point, who has it, cost of status quo | "We solve this by..."       | 60s  |
| 3   | Solution       | What you built, how it works, key insight  | "This creates value..."     | 60s  |
| 4   | Demo/Product   | Screenshot or flow, key feature            | "The market is huge..."     | 60s  |
| 5   | Market Size    | TAM/SAM/SOM, growth rate                   | "We're gaining traction..." | 45s  |
| 6   | Traction       | Key metrics, growth chart                  | "Here's how we grow..."     | 60s  |
| 7   | Business Model | Revenue model, unit economics              | "We beat competitors..."    | 45s  |
| 8   | Competition    | Positioning matrix, differentiation        | "Our team can execute..."   | 45s  |
| 9   | Team           | Founders, relevant experience, why you     | "We're raising to..."       | 45s  |
| 10  | Ask            | Funding amount, use of funds, milestones   | "Our vision is..."          | 30s  |
| 11  | Vision         | Where this goes in 5-10 years              | Close strong                | 30s  |
| 12  | Contact        | Email, website, appendix note              | -                           | 15s  |

## Phase 2: Generate Marp Deck

Create complete Marp markdown:

```markdown
---
marp: true
theme: default
paginate: true
---

# [Company Name]

**[Tagline - max 10 words]**

[Your Name] | [Email]

---

## The Problem

- [Pain point 1 - who experiences it]
- [Pain point 2 - cost of status quo]
- [Pain point 3 - why now]

---

## Our Solution

**[One-sentence value prop]**

- [Key feature 1]
- [Key feature 2]
- [Key insight that makes this work]

---

## How It Works

[Screenshot or diagram description]

1. [Step 1]
2. [Step 2]
3. [Step 3]

---

## Market Opportunity

| Metric       | Value |
| ------------ | ----- |
| **TAM**      | $XB   |
| **SAM**      | $XM   |
| **SOM (Y3)** | $XM   |

[One sentence on market growth/timing]

---

## Traction

| Metric         | Value | Growth  |
| -------------- | ----- | ------- |
| [Key metric 1] | X     | +Y% MoM |
| [Key metric 2] | X     | +Y% MoM |
| [Key metric 3] | X     | +Y% MoM |

[One sentence on what's driving growth]

---

## Business Model

**Revenue:** [How you charge]

| Metric  | Value |
| ------- | ----- |
| ACV     | $X    |
| CAC     | $X    |
| LTV     | $X    |
| LTV:CAC | X:1   |

---

## Competition

| Feature              | Us  | Competitor 1 | Competitor 2 |
| -------------------- | --- | ------------ | ------------ |
| [Feature 1]          | ✓   | ✓            | ✗            |
| [Feature 2]          | ✓   | ✗            | ✓            |
| [Key differentiator] | ✓   | ✗            | ✗            |

**Our edge:** [One sentence]

---

## Team

**[Founder 1]** - [Role]
[One line of relevant experience]

**[Founder 2]** - [Role]
[One line of relevant experience]

[Why this team wins]

---

## The Ask

**Raising:** $X [Stage]

| Use of Funds | %   |
| ------------ | --- |
| [Category 1] | X%  |
| [Category 2] | X%  |
| [Category 3] | X%  |

**Milestones:** [Key milestone with funding]

---

## Vision

**[Big vision statement - where this goes]**

[One sentence on why this matters]

---

## Thank You

**[Your Name]**
[email@company.com]
[website.com]
```

## Phase 3: Brutalist Self-Evaluation

Evaluate against YC's 5 core qualities (2% acceptance rate mindset):

| Quality            | Score (1-5) | Critique                               |
| ------------------ | ----------- | -------------------------------------- |
| **Clarity**        |             | Logical, immediately clear? Confusion? |
| **Brevity**        |             | Minimal words? Overloaded slides?      |
| **Insightfulness** |             | Deep understanding or generic?         |
| **Novelty**        |             | Genuine innovation or rehash?          |
| **Coherence**      |             | Logical flow? Seamless transitions?    |

### Simulated YC Partner Votes

**Paul Graham's Vote:**

> [YES/NO] > [Reasoning: founder quality, market insight, technical innovation, clarity]

**Sam Altman's Vote:**

> [YES/NO] > [Reasoning: ambition, market size, team capability, growth potential]

**Decision:** [ACCEPT/REJECT] _(Requires BOTH YES)_

### Summary

- **Top 3 Strengths:** (if any)
- **Top 3 Fatal Weaknesses:**
- **Confidence:** X% chance of YC interview

## Output

Deliver:

1. Complete Marp deck (copy-paste ready)
2. Investor Q&A prep (one question + answer per slide)
3. Brutalist evaluation with improvement suggestions
4. Recommended deck timing for 10-minute pitch

## Rules

- 2-3 bullet points per slide maximum
- Every slide must earn its place
- Be ruthlessly critical in evaluation
- Most decks are rejected—be honest about weaknesses
- Marp format must be valid (test with `npx @marp-team/marp-cli`)
