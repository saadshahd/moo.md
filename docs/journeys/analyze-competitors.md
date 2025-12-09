# Analyze Competitors

You need to understand the competitive landscape. Who's ahead, where are the gaps, what to build next.

## The Keyword

```
/product:compete "your product and competitors"
```

Examples:
- "/product:compete 'our CRM vs Salesforce, HubSpot, Pipedrive'"
- "/product:compete 'analyzing project management tools'"
- "/product:compete 'comparing our API platform to competitors'"

## What Happens

The system runs a structured competitive analysis:

1. **Landscape overview** — Position each competitor
2. **Feature matrix** — Gap analysis across capabilities
3. **Strategic gaps** — Top 5 gaps with build/buy/partner analysis
4. **Win/loss patterns** — Why you win, why you lose
5. **Roadmap recommendations** — What to build next

## Input Required

The system will ask for:
- Competitor data (features, pricing, reviews)
- Your product context (capabilities, target market, position)
- Win/loss data if available

## Example Session

```
You: /product:compete "our analytics tool vs Mixpanel, Amplitude, Heap"

System: To analyze effectively, I need:

1. What's your current feature set? (event tracking, funnels, cohorts, etc.)
2. What's your target market? (startup, mid-market, enterprise?)
3. Any win/loss data from recent deals?
4. What are customers asking for most?

You: We have events + funnels. Mid-market focus.
     Lost 3 deals to Mixpanel on "real-time dashboards"
     Customers want cohort analysis

System: ## Landscape Overview

### Mixpanel
- Position: Leader
- Strengths: Real-time, mobile focus, intuitive UI
- Weaknesses: Pricing complexity, enterprise features

### Amplitude
- Position: Leader
- Strengths: Behavioral cohorts, enterprise scale
- Weaknesses: Steep learning curve, pricing

### Heap
- Position: Challenger
- Strengths: Auto-capture, retroactive analysis
- Weaknesses: Data volume concerns, less mature

## Feature Matrix
| Category | You | Mixpanel | Amplitude | Heap | Market |
|----------|-----|----------|-----------|------|--------|
| Event tracking | ✅ | ✅ | ✅ | ✅ | Must |
| Funnels | ✅ | ✅ | ✅ | ✅ | Must |
| Real-time | ❌ | ✅ | 🟡 | ❌ | Nice |
| Cohorts | ❌ | ✅ | ✅ | ✅ | Must |

## Strategic Gaps

### Gap 1: Cohort Analysis
**Market Pressure:** High
- Evidence: Customer requests, lost to Amplitude twice
- Competitors: All 3 have it

**Recommendation:** Build — table stakes, 5 story points
...
```

## The Output

Every analysis includes:

**Feature Matrix**
```
| Category | You | Comp A | Comp B | Market Expectation |
|----------|-----|--------|--------|-------------------|
| [Area]   | ✅/🟡/❌ | Status | Status | Must/Nice-to-Have |
```

**Priority Scoring**
```
Priority = (Market Pressure × Deal Impact × Strategic Fit) / Build Effort
```

**Top 3 Recommendations**
- What to build, in priority order
- With rationale grounded in evidence

## Key Discipline

**Ground recommendations in evidence.**

"Customers want X" isn't enough. The system asks:
- How many customers?
- What deal sizes?
- Who did you lose to?

## Related Commands

| Command | Purpose |
|---------|---------|
| `/product:prd` | Build PRD for a gap you decide to fill |
| `/product:metrics` | Define success metrics for new feature |

---

| Say this | Get this |
|----------|----------|
| "/product:compete 'context'" | Full competitive analysis |
| "we lose on X" | Deep dive on that gap |
| "what should we build?" | Prioritized roadmap |

**Next:** [Edit Writing](edit-writing.md) — tighten your prose
