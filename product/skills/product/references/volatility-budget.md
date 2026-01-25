# Metrics Volatility Budget

Review cadences based on metric stability. Prevents over-instrumentation and alert fatigue.

---

## Volatility Categories

| Category | Review Cadence | Examples |
|----------|----------------|----------|
| **High** | Daily | Real-time metrics, A/B test results, error rates |
| **Medium** | Weekly | Conversion rates, engagement metrics, funnel steps |
| **Stable** | Quarterly | Retention cohorts, NPS, revenue metrics, LTV |

---

## Category Characteristics

### High Volatility (Daily)

- Signal-to-noise ratio is low
- Requires statistical significance before acting
- Alert thresholds must account for natural variance
- Best for: operational health, active experiments

### Medium Volatility (Weekly)

- Trends emerge over 7-14 days
- Weekly review prevents overreaction to noise
- Good for: feature adoption, user behavior shifts

### Stable (Quarterly)

- Lagging indicators of product health
- Changes here reflect sustained shifts
- Premature optimization wastes effort
- Good for: strategic decisions, OKRs

---

## Application Rules

1. **Match review cadence to volatility** — Daily checks on quarterly metrics create false urgency
2. **Set alerts only for appropriate tiers** — Real-time alerts for stable metrics = noise
3. **Aggregate before acting** — Weekly metrics need week-over-week comparison, not day-over-day
4. **Budget instrumentation** — High-volatility metrics justify dashboards; stable metrics need quarterly reports

---

## Over-Instrumentation Signs

- Dashboards nobody checks
- Alerts that get ignored
- Daily standups discussing quarterly metrics
- "The numbers are down today" anxiety

---

## Metric Placement Checklist

Before adding a metric, answer:

1. How often does this metric naturally change?
2. At what frequency can we meaningfully act on it?
3. Does our review cadence match the metric's volatility?
4. Are we instrumenting this because it's useful or because we can?

**Default:** If unsure, start with lower-frequency review. Increase cadence only if decisions are blocked.
