# Size Market

Calculate TAM/SAM/SOM with multiple methodologies for investor credibility.

## Input Required

Ask for each missing item ONE at a time:

1. **Product/Service:** What are you selling? (detailed description)
2. **Target Geography:** Countries/regions you'll operate in?
3. **Customer Profile:**
   - Type: B2B/B2C/B2B2C?
   - Specific segment: Who exactly buys?
   - Pain point: What problem you solve?
4. **Pricing Model:** How you charge? (subscription/one-time/usage)
5. **Competitive Context:** New category/replacing existing/part of stack?

## Phase 1: Market Understanding

Confirm business model and market dynamics (2-3 sentences).

## Phase 2: Calculate TAM (Total Addressable Market)

### Method 1: Top-Down

| Component                  | Value          | Source          |
| -------------------------- | -------------- | --------------- |
| Industry total market size | $X             | [Report/Source] |
| Relevant segment           | Y%             |                 |
| Geographic filter          | Z%             |                 |
| **TAM**                    | $[Calculation] |                 |

### Method 2: Bottom-Up Validation

| Component                 | Value            | Assumption |
| ------------------------- | ---------------- | ---------- |
| Total potential customers | [Number]         |            |
| Average contract value    | $[Amount]        |            |
| Frequency                 | [Annual/Monthly] |            |
| **TAM**                   | $[Calculation]   |            |

### Reconciliation

| Method          | TAM       | Confidence  |
| --------------- | --------- | ----------- |
| Top-down        | $X        |             |
| Bottom-up       | $Y        |             |
| **Recommended** | $[Amount] | [Rationale] |

## Phase 3: Calculate SAM (Serviceable Addressable Market)

Apply reality filters:

| Filter                 | Reduction | Rationale                                 |
| ---------------------- | --------- | ----------------------------------------- |
| Geographic constraints | X%        | Starting markets, expansion timeline      |
| Product fit limits     | Y%        | Feature gaps, customer size limits        |
| Competitive reality    | Z%        | Lock-in, education needed, channel limits |

**SAM = TAM × Geographic% × ProductFit% × Competitive% = $[SAM]**

## Phase 4: Calculate SOM (Serviceable Obtainable Market)

### Year 1 Achievable

| Factor              | Estimate  | Basis                 |
| ------------------- | --------- | --------------------- |
| Sales capacity      |           |                       |
| Marketing reach     |           |                       |
| Product readiness   |           |                       |
| Target market share | X%        | Comparable: [Company] |
| **SOM Year 1**      | $[Amount] |                       |

### Years 2-3 Projection

| Year   | Growth Rate | Market Share | SOM       |
| ------ | ----------- | ------------ | --------- |
| Year 1 | -           | X%           | $[Amount] |
| Year 2 | Y%          | X%           | $[Amount] |
| Year 3 | Y%          | X%           | $[Amount] |

## Phase 5: Scenario Planning

| Scenario     | Probability | TAM | SAM | SOM (Y3) | Key Assumption |
| ------------ | ----------- | --- | --- | -------- | -------------- |
| Conservative | 60%         |     |     |          |                |
| Base         | 30%         |     |     |          |                |
| Optimistic   | 10%         |     |     |          |                |

## Output: Investor-Ready Slide (Marp)

Generate a Marp slide for the pitch deck:

```markdown
---
marp: true
---

# Market Opportunity

## TAM: $[X]B

[One-line description of total market]

## SAM: $[X]M

[Geographic + segment focus]

## SOM: $[X]M (Year 3)

[Realistic capture based on resources]

---

### Methodology

- **Top-down:** [Source] → $[TAM]
- **Bottom-up:** [Customers] × $[ACV] → $[TAM]
- **Reality filters:** [Key constraints]

### Key Assumptions

1. [Assumption 1]
2. [Assumption 2]
3. [Assumption 3]
```

## Rules

- Always use both top-down AND bottom-up methods
- Cite data sources (even if estimates)
- Be conservative—investors discount inflated TAMs
- SAM filters must be defensible
- SOM must tie to actual resources (sales headcount, marketing budget)
- Use ask tool to gather each input ONE at a time
