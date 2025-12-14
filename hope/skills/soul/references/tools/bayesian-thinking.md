# Bayesian Thinking

Update beliefs proportionally to new evidence. Assign probabilities to beliefs and revise them as information arrives.

---

## When to Use

- Debugging with incomplete information
- Evaluating competing hypotheses
- Confidence calibration
- Risk assessment
- Any situation with uncertainty

---

## The Framework

### Core Principle

```
P(Hypothesis | Evidence) ∝ P(Evidence | Hypothesis) × P(Hypothesis)

Posterior ∝ Likelihood × Prior
```

In plain language:

- **Prior**: What you believed before new evidence
- **Likelihood**: How probable is this evidence if hypothesis is true?
- **Posterior**: Updated belief after seeing evidence

### Practical Steps

1. **State prior belief** with explicit probability (e.g., "70% confident this is a caching bug")
2. **Observe evidence** (logs, metrics, reproduction)
3. **Ask**: How likely is this evidence under each hypothesis?
4. **Update**: Shift probability toward hypotheses that better explain evidence
5. **Repeat** as new evidence arrives

---

## Example: Debugging

**Prior beliefs:**

- 60%: Database timeout
- 30%: Network issue
- 10%: Application bug

**Evidence**: Error only occurs between 2-4 PM.

**Update**: Network and DB issues less likely to be time-specific. Application bug (scheduled job?) now more probable.

**New posterior:**

- 20%: Database timeout
- 10%: Network issue
- 70%: Application bug (check cron jobs)

---

## Key Principles

| Principle                  | Meaning                                          |
| -------------------------- | ------------------------------------------------ |
| **Never 0% or 100%**       | Leave room for surprise                          |
| **Evidence moves beliefs** | Strong evidence = big shift                      |
| **Priors matter**          | Extraordinary claims need extraordinary evidence |
| **Update incrementally**   | Don't swing wildly on single data point          |

---

## Calibration Check

Track your predictions. If you say "80% confident" 10 times, you should be right ~8 times.

| Stated Confidence | Should Be Right |
| ----------------- | --------------- |
| 50%               | 5/10 times      |
| 80%               | 8/10 times      |
| 95%               | 19/20 times     |

If you're always right at 80%, you're underconfident. If rarely right, overconfident.

---

## Anti-Patterns

- **Ignoring base rates**: Rare bugs are rare, even with suspicious evidence
- **Confirmation bias**: Only seeking evidence that confirms hypothesis
- **Anchoring**: Not updating enough from prior
- **Binary thinking**: "It's either X or Y" when probability is distributed

---

## Grey Thinking Integration

Bayesian thinking naturally supports nuance over binary categorization.

**The dose makes the poison** (Paracelsus):

- Nothing is universally good or bad
- Everything depends on quantity and context
- Assign probabilities on a continuum, not in buckets

**False dichotomy detection:**

When you catch yourself thinking binary:

- "Is this a good or bad idea?" → "What probability of success?"
- "Should we do X or not?" → "Under what conditions does X make sense?"
- "Is this person right or wrong?" → "What percentage of their argument holds?"

**Continuum questions:**

1. Where does this fall on the spectrum? (30%? 70%?)
2. At what scale/dose does it become problematic?
3. What context would shift the probability?

**Example:**

```
Binary: "Technical debt is bad"

Bayesian + Grey:
- Probability debt causes problems = f(interest rate, payoff timeline)
- Strategic debt (knowingly taken, planned payoff): 20% harmful
- Accidental debt (accumulated unknowingly): 80% harmful
- Context: Fast-moving startup vs regulated enterprise

Updated belief: "Technical debt probability of harm depends
on intentionality, visibility, and payoff timeline"
```

---

## Combination

Pairs with:

- [Confidence Gates](../../../SKILL.md): Bayesian updates inform confidence levels
- [Pre-Mortem](pre-mortem.md): Assign probabilities to failure modes

---

## Provenance

Thomas Bayes (1701-1761), formalized by Pierre-Simon Laplace. Foundation of modern statistics, machine learning, and scientific reasoning.
