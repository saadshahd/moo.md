# Report to Board

Create a board-ready Marp deck with metrics summary and executive analysis.

## Input Required

Ask for (if not provided):

- Company name
- Reporting period (Q1 2024, monthly, etc.)
- Key metrics you have (ARR, users, churn, burn, runway)
- Major wins this period
- Major challenges or misses
- Key decisions needed from board

## Phase 1: Revenue Trends

### Monthly Revenue Table (Last 12 months)

| Month   | Product | Service | Other | Total | MoM $ | MoM % | YoY % |
| ------- | ------- | ------- | ----- | ----- | ----- | ----- | ----- |
| [M-11]  | $       | $       | $     | $     |       |       |       |
| [M-10]  | $       | $       | $     | $     | $     | %     | %     |
| ...     |         |         |       |       |       |       |       |
| Current | $       | $       | $     | $     | $     | %     | %     |

### Calculated Metrics

| Metric             | Value | Trend    |
| ------------------ | ----- | -------- |
| TTM Revenue        | $     |          |
| Monthly Average    | $     |          |
| Run Rate (ARR)     | $     |          |
| 3-Month Average    | $     |          |
| Average MoM Growth | %     | 🟢/🟡/🔴 |

## Phase 2: Cash Runway

### Cash Position

| Metric         | Value | vs. Plan |
| -------------- | ----- | -------- |
| Beginning Cash | $     |          |
| Cash In        | $     |          |
| Cash Out       | $     |          |
| Net Burn       | $     |          |
| Ending Cash    | $     |          |

### Runway Calculation

| Scenario         | Monthly Burn | Runway (months) | Status   |
| ---------------- | ------------ | --------------- | -------- |
| Current          | $            | X               | 🟢/🟡/🔴 |
| If hiring paused | $            | X               |          |
| With next round  | $            | X               |          |

**Runway Status:**

- 🟢 >18 months
- 🟡 12-18 months
- 🔴 <12 months

## Phase 3: KPI Dashboard

### Core Metrics

| KPI           | Current | Prior Period | Target | Status |
| ------------- | ------- | ------------ | ------ | ------ |
| ARR           | $       | $            | $      |        |
| MRR           | $       | $            | $      |        |
| Customers     | #       | #            | #      |        |
| Logo Churn    | %       | %            | %      |        |
| Revenue Churn | %       | %            | %      |        |
| NRR           | %       | %            | %      |        |

### Unit Economics

| Metric           | Value | Benchmark | Status   |
| ---------------- | ----- | --------- | -------- |
| CAC              | $     | -         |          |
| LTV              | $     | -         |          |
| LTV:CAC          | X:1   | >3:1      | 🟢/🟡/🔴 |
| Payback (months) | X     | <12       | 🟢/🟡/🔴 |
| Gross Margin     | %     | >70%      | 🟢/🟡/🔴 |

### Efficiency Metrics

| Metric        | Value | Target |
| ------------- | ----- | ------ |
| Burn Multiple | X     | <2x    |
| Rule of 40    | X%    | >40%   |
| Magic Number  | X     | >0.75  |

## Phase 4: Department Spend

### Spend by Department

| Department        | Budget | Actual | Variance | % of Total |
| ----------------- | ------ | ------ | -------- | ---------- |
| Engineering       | $      | $      | $        | %          |
| Sales & Marketing | $      | $      | $        | %          |
| G&A               | $      | $      | $        | %          |
| **Total**         | $      | $      | $        | 100%       |

### Headcount

| Department  | Beginning | +Hires | -Departures | Ending | Plan |
| ----------- | --------- | ------ | ----------- | ------ | ---- |
| Engineering |           |        |             |        |      |
| Sales       |           |        |             |        |      |
| Marketing   |           |        |             |        |      |
| G&A         |           |        |             |        |      |
| **Total**   |           |        |             |        |      |

## Phase 5: Generate Marp Board Deck

```markdown
---
marp: true
theme: default
paginate: true
---

# [Company] Board Update

**[Period]** | **[Date]**

---

## Executive Summary

### Highlights

- 🟢 [Win 1]
- 🟢 [Win 2]
- 🟢 [Win 3]

### Challenges

- 🟡 [Challenge 1]
- 🟡 [Challenge 2]

### Decisions Needed

- [Decision 1]
- [Decision 2]

---

## Financial Summary

| Metric       | Actual | Plan | Variance |
| ------------ | ------ | ---- | -------- |
| Revenue      | $      | $    | $        |
| Gross Margin | %      | %    | %        |
| OpEx         | $      | $    | $        |
| EBITDA       | $      | $    | $        |
| Cash         | $      | $    | $        |
| Runway       | X mo   | X mo |          |

---

## Revenue Performance

|          | Q1  | Q2  | Q3  | Q4  | YTD |
| -------- | --- | --- | --- | --- | --- |
| Revenue  | $   | $   | $   | $   | $   |
| Growth   | %   | %   | %   | %   | %   |
| vs. Plan | %   | %   | %   | %   | %   |

**Commentary:** [1-2 sentences on revenue story]

---

## Key Metrics

| KPI         | Current | Target | Trend |
| ----------- | ------- | ------ | ----- |
| ARR         | $       | $      | ↑/↓   |
| Customers   | #       | #      | ↑/↓   |
| NRR         | %       | %      | ↑/↓   |
| CAC Payback | X mo    | X mo   | ↑/↓   |

---

## Cash & Runway

|              | Current  | Plan     |
| ------------ | -------- | -------- |
| Cash Balance | $        | $        |
| Monthly Burn | $        | $        |
| Runway       | X months | X months |

**Next Funding:** [Timeline and amount if applicable]

---

## Priorities: Next Quarter

1. **[Priority 1]** - [Owner] - [Success metric]
2. **[Priority 2]** - [Owner] - [Success metric]
3. **[Priority 3]** - [Owner] - [Success metric]

---

## Decisions Requested

### [Decision 1]

- **Context:** [Brief background]
- **Options:** A) [Option A] B) [Option B]
- **Recommendation:** [Your recommendation]

### [Decision 2]

- **Context:** [Brief background]
- **Recommendation:** [Your recommendation]

---

## Appendix

[Reference to detailed materials]
```

## Output Format

Deliver:

1. **Marp board deck** (10-12 slides, copy-paste ready)
2. **Metrics summary table** (spreadsheet-ready)
3. **Executive summary** (1 paragraph for email)

## Rules

- Keep slides scannable (executives have limited time)
- Lead with headlines, not data
- Flag metrics that need attention (🟢/🟡/🔴)
- Include decisions requested explicitly
- No surprises—if there's bad news, surface it clearly
- Use Ask tool to gather all metrics before generating
