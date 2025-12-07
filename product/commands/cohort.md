---
description: Analyze customer cohorts for retention, revenue trends, LTV, and churn patterns. Builds retention matrix and strategic recommendations.
---

# /cohort

Analyze customer cohort data for retention, expansion, and lifetime value insights.

## Phase 1: Data Collection

Ask for:

- Cohort data (customers by acquisition month, revenue per period)
- Data format (CSV, table, or describe)
- Customer vs revenue retention preference
- Segments to compare (enterprise/SMB, channel, geography)

## Phase 2: Retention Table

Build cohort retention matrix:

```
Cohort      Month 0  Month 1  Month 3  Month 6  Month 12
Jan 2024    100%     96%      92%      88%      82%
Feb 2024    100%     97%      94%      90%      --
```

**Color key:**
- >100% = expansion (dark green)
- 90-100% = healthy (light green)
- 75-90% = concerning (yellow)
- 50-75% = poor (orange)
- <50% = severe churn (red)

## Phase 3: Metrics Calculation

Calculate for each cohort:

**Retention rates:**
- Month 1, 3, 6, 12 customer retention
- Month 1, 3, 6, 12 revenue retention

**Aggregate metrics:**
- GRR (Gross Revenue Retention): Revenue retained excluding expansion
- NRR (Net Revenue Retention): Revenue retained including expansion
- Average retention curve across all cohorts

**Benchmarks:**
- Good SaaS: 85-90% GRR, >110% NRR
- Excellent: >90% GRR, >120% NRR

## Phase 4: LTV Analysis

For mature cohorts (12+ months):

```
### Cohort: [Month/Year]

Historical LTV: [Total revenue / Original customers]
Predictive LTV: [ARPC / Monthly churn rate]
Payback Period: [CAC / Monthly ARPC] months
LTV:CAC Ratio: [X]:1

Benchmark: >3:1 healthy, >5:1 excellent
```

**Blended company metrics:**
- Overall LTV (weighted average)
- Overall payback period
- LTV trend by cohort vintage

## Phase 5: Insights

Generate actionable findings:

**Churn patterns:**
- Peak churn period: Month [X] - proactive outreach at [X-1]
- Plateau point: Month [X] - customers past this are long-term

**Expansion patterns:**
- Average expansion timing: Month [X]
- Expansion rate by segment

**Cohort comparison:**
- Best performing: [Cohort] - [Why]
- Worst performing: [Cohort] - [Why]
- Trend: Newer cohorts [improving/declining]

**Segment differences:**
- [Segment A] vs [Segment B]: [X]% point difference

## Output Summary

```
## Cohort Analysis Summary

| Metric | Value | Benchmark | Status |
|--------|-------|-----------|--------|
| GRR | X% | 85-90% | [🟢/🟡/🔴] |
| NRR | X% | >110% | [🟢/🟡/🔴] |
| LTV:CAC | X:1 | >3:1 | [🟢/🟡/🔴] |
| Payback | X mo | <12 mo | [🟢/🟡/🔴] |

## Top 3 Actions
1. [Action] - Expected impact: [X]
2. [Action] - Expected impact: [X]
3. [Action] - Expected impact: [X]
```

## Rules

- Use ask tool to gather data
- Mark immature cohorts (<3 months) as preliminary
- Quantify recommendations with expected impact
- Compare to SaaS benchmarks

---

$ARGUMENTS
