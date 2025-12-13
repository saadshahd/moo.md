# Opportunity Cost

Every choice has a cost: the value of the best alternative you didn't choose. What are you giving up?

---

## When to Use

- Resource allocation (time, money, attention)
- Feature prioritization
- Technology decisions
- Career choices
- Any either/or decision

---

## The Framework

### Core Question

> "By choosing X, what am I giving up?"

The cost of a decision isn't just what you spend—it's what you can't do with those resources.

### Calculation

```
Opportunity Cost = Value of Best Alternative Foregone
```

| You Choose | You Spend | Opportunity Cost |
|------------|-----------|------------------|
| Build feature A | 2 weeks | Feature B, C, or D you could have built |
| Learn framework X | 40 hours | Deep dive into fundamentals |
| Attend meeting | 1 hour | 1 hour of focused work |

---

## Examples

### Engineering Decision

**Choice**: Build custom auth system
**Direct cost**: 3 weeks dev time
**Opportunity cost**:
- 3 weeks of product features
- Using Auth0/Cognito and shipping in 3 days
- Tech debt reduction work

**Real cost** = 3 weeks + best alternative value

### Career Decision

**Choice**: Stay at current job
**Direct cost**: Apparent stability
**Opportunity cost**:
- Higher salary elsewhere
- New skills and challenges
- Different network and opportunities

---

## Application to Prioritization

When ranking features:

| Feature | Value | Dev Time | Opportunity Cost |
|---------|-------|----------|------------------|
| A | High | 1 week | Low (quick win) |
| B | Medium | 4 weeks | High (blocks A, C, D, E) |
| C | High | 2 weeks | Medium |

**Insight**: B's opportunity cost makes it less attractive than raw value suggests.

---

## Hidden Opportunity Costs

| Action | Hidden Cost |
|--------|-------------|
| "Quick" meeting | Deep work interruption |
| Saying yes to project | Everything you can't do instead |
| Technical debt | Future velocity |
| Premature optimization | Features not built |
| Over-engineering | Simplicity lost |

---

## Decision Framework

1. **Identify alternatives**: What else could you do with these resources?
2. **Estimate values**: Roughly, what's each alternative worth?
3. **Find the best alternative**: This is your opportunity cost
4. **Compare**: Is chosen option worth more than opportunity cost?

---

## Anti-Patterns

- **Ignoring opportunity cost**: Only considering direct costs
- **Analysis paralysis**: Infinite alternatives considered
- **Sunk cost confusion**: Past investments don't affect opportunity cost
- **Zero-sum thinking**: Sometimes alternatives aren't mutually exclusive

---

## Combination

Pairs with:
- [Sunk Cost Fallacy](sunk-cost.md): Don't let past costs inflate opportunity cost
- [Pareto Principle](pareto.md): Focus on 20% with highest opportunity cost differential
- [Eisenhower Matrix](eisenhower.md): Urgent tasks often have hidden opportunity costs

---

## Provenance

Foundational concept in economics. Formalized by Friedrich von Wieser (1914). Applies universally to any scarce resource allocation.
