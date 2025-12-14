# founder — Power User Reference

Startup workflows for Claude Code.

---

| Say this                  | Get this                                     |
| ------------------------- | -------------------------------------------- |
| "validate my idea"        | GO/ITERATE/KILL verdict + falsification test |
| "size my market"          | TAM/SAM/SOM calculations + Marp slide        |
| "analyze my competitors"  | Threat matrix + positioning                  |
| "build my pitch deck"     | 10-12 slide Marp deck                        |
| "prep me for investors"   | Q&A document (10 brutal questions)           |
| "model my financials"     | Spreadsheet-ready tables                     |
| "plan my launch"          | 90-day execution plan                        |
| "prepare my board report" | Marp deck + metrics summary                  |

---

## Install

```bash
/plugin install founder@moo.md
```

## When It Activates

Auto-triggers on:

- Idea validation, value proposition testing
- Market sizing (TAM/SAM/SOM)
- Competitive analysis, threat assessment
- Pitch deck creation or evaluation
- Investor meeting preparation
- Financial modeling (unit economics, projections, cash flow)
- Launch planning, go-to-market
- Board reporting, investor updates

## Commands

| Command                  | Purpose                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `/founder:validate`      | Idea validation. DFV scoring + stress test + GO/ITERATE/KILL verdict.    |
| `/founder:market-size`   | Market sizing. Top-down + bottom-up TAM/SAM/SOM with Marp slide.         |
| `/founder:compete`       | Competition analysis. Blitzscaling scores + threat matrix + positioning. |
| `/founder:pitch`         | Pitch deck. 10-12 Marp slides + brutalist YC-style evaluation.           |
| `/founder:investor-prep` | Investor prep. 10 brutal questions with honest answers.                  |
| `/founder:financials`    | Financial modeling. Unit economics + 3Y projection + 13W cash flow.      |
| `/founder:launch`        | Launch planning. 90-day phased roadmap with weekly tasks.                |
| `/founder:board`         | Board reporting. Marp deck with revenue, runway, KPIs.                   |

## When to Use

| Situation                                | Command                                        |
| ---------------------------------------- | ---------------------------------------------- |
| Have an idea, unsure if worth pursuing   | `/founder:validate`                            |
| Investors asking about market size       | `/founder:market-size`                         |
| Need to understand competitive landscape | `/founder:compete`                             |
| Preparing for investor meetings          | `/founder:pitch` then `/founder:investor-prep` |
| Need financial projections               | `/founder:financials`                          |
| Launching a product                      | `/founder:launch`                              |
| Quarterly board meeting                  | `/founder:board`                               |

---

## Validate Idea Workflow

The `/founder:validate` command scores ideas across two dimensions:

**DFV Quick Score (0-10 each):**

- Desirability — Do users actually want this?
- Feasibility — Can we build this with current tech?
- Viability — Can we make money from this?

**Stress Test (5 weighted axes):**
| Axis | Weight |
|------|--------|
| Pain Intensity | 30% |
| Budget Reality | 25% |
| Pain Frequency | 20% |
| AI Feasibility | 15% |
| Switching Friction | 10% |

**Verdict:** GO (≥75), ITERATE (50-74), KILL (<50)

Each verdict includes a killer assumption (≤15 words) and a 48-hour falsification test.

## Size Market Workflow

The `/founder:market-size` command uses three methodologies:

1. **Top-Down** — Industry reports → segment → share capture
2. **Bottom-Up** — Unit pricing × reachable customers
3. **Comparable** — Revenue-per-employee from similar companies

Outputs:

- TAM/SAM/SOM tables with citations
- Marp slide ready for pitch deck

## Analyze Competition Workflow

The `/founder:compete` command produces:

**Blitzscaling Analysis (4 factors, 1-5 each):**
| Factor | Question |
|--------|----------|
| Market Size | Is winning worth $10B+? |
| Distribution | Can you acquire customers faster than competitors? |
| Margin Wedge | >60% gross margins possible at scale? |
| Network Effects | Does product strengthen with each new user? |

**Threat Matrix:** Lists each competitor with their advantages and your counter.

**Positioning Statement:** Tight differentiation against the closest threat.

## Build Pitch Workflow

The `/founder:pitch` command generates a complete Marp deck:

| Slide | Content              |
| ----- | -------------------- |
| 1     | Title + one-liner    |
| 2     | Problem (stakes)     |
| 3     | Solution (demo)      |
| 4     | Market (TAM/SAM/SOM) |
| 5     | Business Model       |
| 6     | Traction             |
| 7     | Competition          |
| 8     | Team                 |
| 9     | Financials           |
| 10    | Ask                  |

Includes brutalist self-evaluation with simulated PG and Sam Altman votes (2% acceptance rate mindset).

## Prep for Investors Workflow

The `/founder:investor-prep` command generates:

1. **10 Brutal Questions** — The hardest questions VCs will ask
2. **Honest Answers** — Direct, evidence-based responses
3. **Follow-Up Attacks** — Secondary probes for the 3 weakest answers
4. **Red Flag Audit** — What might kill the deal
5. **Practice Protocol** — How to rehearse

## Model Financials Workflow

The `/founder:financials` command generates three spreadsheet-ready tables:

**Unit Economics:**

- CAC by channel (direct, inside, paid, organic, partner)
- LTV calculation with contribution margin
- LTV:CAC ratio (benchmark: >3:1)
- Payback period (benchmark: <12 months)

**3-Year Projection:**

- Revenue model (customers, churn, MRR, ARR)
- Expense model (COGS, engineering, S&M, G&A)
- P&L summary with margins

**13-Week Cash Flow:**

- Weekly cash in/out
- Ending balance
- Runway alert (🟢 >26w / 🟡 13-26w / 🔴 <13w)

## Plan Launch Workflow

The `/founder:launch` command creates a 90-day plan:

| Phase      | Days  | Focus                                |
| ---------- | ----- | ------------------------------------ |
| Pre-Launch | 1-30  | Audience building, content, waitlist |
| Launch     | 31-60 | Public launch, PR, partnerships      |
| Growth     | 61-90 | Optimization, retention, scale       |

Each phase includes weekly tasks, example copy, and success metrics.

## Report to Board Workflow

The `/founder:board` command generates a Marp deck with:

1. **Executive Summary** — 3-bullet status
2. **Revenue Trends** — MRR/ARR charts
3. **Cash Runway** — Weeks remaining
4. **KPI Dashboard** — Key metrics vs. targets
5. **Department Spend** — Budget vs. actual

---

## Artifact Conversion

All workflows produce markdown. Convert to final formats:

| Artifact             | Command                                        |
| -------------------- | ---------------------------------------------- |
| Slides → PowerPoint  | `npx @marp-team/marp-cli slides.md --pptx`     |
| Slides → PDF         | `npx @marp-team/marp-cli slides.md --pdf`      |
| Document → PDF       | `npx md-to-pdf document.md`                    |
| Tables → Spreadsheet | Copy markdown tables, paste into Google Sheets |

---

→ Source: [`founder/skills/founder/SKILL.md`](../../founder/skills/founder/SKILL.md)
