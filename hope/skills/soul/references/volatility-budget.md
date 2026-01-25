# Volatility Budget

Classify what can change and how often.

## Tiers

| Tier | Change Frequency | Examples |
|------|-----------------|----------|
| **GREEN** | Daily | Internal implementation, logs, dev tooling, comments |
| **YELLOW** | With notice | Config formats, CLI flags, internal APIs, error messages |
| **RED** | Rarely | Data formats, public API contracts, muscle-memory UX, pricing |

## Classification Questions

1. **Who sees this?** Internal only → GREEN. External → YELLOW or RED.
2. **What breaks if it changes?** Nothing → GREEN. Scripts/integrations → YELLOW. User workflows → RED.
3. **Is there a contract?** Implicit → YELLOW. Explicit (docs, schema) → RED.
4. **Can users work around it?** Easily → YELLOW. Requires relearning → RED.

## Hidden Reds

Things that feel GREEN but are actually RED:

| Looks Like | Actually | Why |
|------------|----------|-----|
| Error message text | RED | Users grep logs, scripts parse errors |
| CLI flag names | RED | Scripts depend on exact flags |
| Default values | RED | Users build workflows assuming defaults |
| File locations | RED | Automation hardcodes paths |
| Timing/performance | YELLOW | Users notice degradation, build assumptions |

## Change Protocol by Tier

### GREEN

- Change freely
- No announcement required
- No deprecation period

### YELLOW

- Announce in changelog
- Provide migration path
- 1 release deprecation notice
- Old behavior warns, doesn't break

### RED

- Major version bump required
- 2+ release deprecation period
- Migration tooling provided
- Document breaking change prominently
- Consider: Is this change worth the cost?

## Budget Allocation

Total volatility capacity is limited. Spending it on RED changes has compounding costs.

| Change Type | Trust Cost | Recovery Time |
|-------------|------------|---------------|
| GREEN | 0 | Instant |
| YELLOW | Low | 1 release cycle |
| RED | High | 6+ months of stability |

## Pre-Change Checklist

Before changing anything:

1. What tier is this? (Assume YELLOW if unsure)
2. Who depends on current behavior?
3. What's the migration path?
4. Is the improvement worth the churn?
5. Can we achieve the goal without breaking compatibility?
