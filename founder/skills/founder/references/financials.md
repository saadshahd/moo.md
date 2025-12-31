# Model Financials

Generate spreadsheet-ready financial tables: unit economics, 3-year projection, and 13-week cash flow.

## Input Required

Ask for (if not provided):

- Business model (SaaS/marketplace/e-commerce/services)
- Current stage (pre-revenue/revenue/scaling)
- Key metrics you have (customers, ARR, churn, CAC)
- Funding status and runway needs

## Phase 1: Assumptions Sheet

Create the single source of truth for all model inputs:

### Revenue Assumptions

| Assumption           | Year 1 | Year 2 | Year 3 | Notes |
| -------------------- | ------ | ------ | ------ | ----- |
| Starting customers   |        |        |        |       |
| New customers/month  |        |        |        |       |
| ARPC (annual)        |        |        |        |       |
| Churn rate (monthly) |        |        |        |       |
| Price increase       |        |        |        |       |

### Segment Breakdown

| Segment    | % of Customers | ARPC | Churn | Growth |
| ---------- | -------------- | ---- | ----- | ------ |
| Enterprise |                |      |       |        |
| Mid-Market |                |      |       |        |
| SMB        |                |      |       |        |

### Cost Assumptions

| Category             | Amount | Basis | Scaling |
| -------------------- | ------ | ----- | ------- |
| COGS % of revenue    |        |       |         |
| Hosting per customer |        |       |         |
| Payment processing   |        |       |         |

## Phase 2: Unit Economics

### CAC by Channel

| Channel         | S&M Spend | New Customers | CAC | % of Total |
| --------------- | --------- | ------------- | --- | ---------- |
| Direct Sales    | $         |               | $   | %          |
| Inside Sales    | $         |               | $   | %          |
| Paid Ads        | $         |               | $   | %          |
| Content/Organic | $         |               | $   | %          |
| Partner         | $         |               | $   | %          |
| **Blended**     | $         |               | $   | 100%       |

### Revenue Per Customer

| Segment     | Customers | Total ARR | ARPC | vs. Avg |
| ----------- | --------- | --------- | ---- | ------- |
| Enterprise  |           | $         | $    | +X%     |
| Mid-Market  |           | $         | $    | +X%     |
| SMB         |           | $         | $    | -X%     |
| **Blended** |           | $         | $    | --      |

### Contribution Margin

| Revenue Source | ARPC | COGS | CM  | CM % |
| -------------- | ---- | ---- | --- | ---- |
| Core Product   | $    | $    | $   | %    |
| Add-ons        | $    | $    | $   | %    |
| Services       | $    | $    | $   | %    |
| **Blended**    | $    | $    | $   | %    |

### LTV Calculation

```
LTV = (ARPC × Contribution Margin %) / Monthly Churn Rate

Example:
- ARPC = $3,000/year = $250/month
- Contribution Margin = 75%
- Monthly Churn = 3%
- LTV = ($250 × 0.75) / 0.03 = $6,250
```

### Payback Period

```
Payback = CAC / (Monthly ARPC × CM%)

Example:
- CAC = $4,400
- Monthly ARPC = $250
- CM = 75%
- Payback = $4,400 / ($250 × 0.75) = 23.5 months
```

### Key Metrics Summary

| Metric              | Value | Benchmark | Status   |
| ------------------- | ----- | --------- | -------- |
| Blended CAC         | $     | -         |          |
| LTV                 | $     | -         |          |
| LTV:CAC             | X:1   | >3:1      | 🟢/🟡/🔴 |
| Payback (months)    | X     | <12       | 🟢/🟡/🔴 |
| Contribution Margin | X%    | >70%      | 🟢/🟡/🔴 |
| Gross Margin        | X%    | >60%      | 🟢/🟡/🔴 |

## Phase 3: 3-Year Projection

### Revenue Model

|                     | Y1 Q1 | Y1 Q2 | Y1 Q3 | Y1 Q4 | Y2  | Y3  |
| ------------------- | ----- | ----- | ----- | ----- | --- | --- |
| Beginning Customers |       |       |       |       |     |     |
| + New Customers     |       |       |       |       |     |     |
| - Churned           |       |       |       |       |     |     |
| = Ending Customers  |       |       |       |       |     |     |
| MRR                 | $     | $     | $     | $     | $   | $   |
| ARR                 | $     | $     | $     | $     | $   | $   |

### Expense Model

|                    | Y1 Q1 | Y1 Q2 | Y1 Q3 | Y1 Q4 | Y2  | Y3  |
| ------------------ | ----- | ----- | ----- | ----- | --- | --- |
| **COGS**           |       |       |       |       |     |     |
| Hosting            | $     | $     | $     | $     | $   | $   |
| Payment Processing | $     | $     | $     | $     | $   | $   |
| **Gross Profit**   | $     | $     | $     | $     | $   | $   |
| **OpEx**           |       |       |       |       |     |     |
| Engineering        | $     | $     | $     | $     | $   | $   |
| Sales & Marketing  | $     | $     | $     | $     | $   | $   |
| G&A                | $     | $     | $     | $     | $   | $   |
| **Total OpEx**     | $     | $     | $     | $     | $   | $   |
| **EBITDA**         | $     | $     | $     | $     | $   | $   |

### P&L Summary

|                    | Year 1 | Year 2 | Year 3 |
| ------------------ | ------ | ------ | ------ |
| Revenue            | $      | $      | $      |
| COGS               | $      | $      | $      |
| **Gross Profit**   | $      | $      | $      |
| Gross Margin %     | %      | %      | %      |
| Operating Expenses | $      | $      | $      |
| **EBITDA**         | $      | $      | $      |
| EBITDA Margin %    | %      | %      | %      |

## Phase 4: 13-Week Cash Flow

### Weekly Cash Flow

| Week               | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | 10  | 11  | 12  | 13  |
| ------------------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Cash In**        |     |     |     |     |     |     |     |     |     |     |     |     |     |
| Collections        | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   |
| Other              | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   |
| **Total In**       | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   |
| **Cash Out**       |     |     |     |     |     |     |     |     |     |     |     |     |     |
| Payroll            | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   |
| Vendors            | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   |
| Other              | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   |
| **Total Out**      | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   |
| **Net Cash**       | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   |
| **Ending Balance** | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   | $   |

### Runway Alert

| Metric         | Value | Status                        |
| -------------- | ----- | ----------------------------- |
| Current Cash   | $     |                               |
| Weekly Burn    | $     |                               |
| Runway (weeks) | X     | 🟢 >26w / 🟡 13-26w / 🔴 <13w |

## Output Format

Generate three markdown tables ready to paste into Google Sheets/Excel:

1. **Unit Economics Table** - CAC, LTV, payback, margins
2. **3-Year P&L** - Quarterly Y1, annual Y2-Y3
3. **13-Week Cash Flow** - Weekly cash position

Include:

- All cells with $ amounts or percentages
- Benchmark comparisons
- Color-coding guidance (conditional formatting rules)

## Rules

- All tables must be valid markdown (paste-ready)
- Include formulas as comments where helpful
- Benchmark against SaaS standards (LTV:CAC >3:1, payback <12mo, GM >70%)
- Flag metrics that need attention (🟢/🟡/🔴)
- Use Ask tool to gather key assumptions before generating tables
