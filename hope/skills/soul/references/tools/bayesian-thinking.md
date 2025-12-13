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

| Principle | Meaning |
|-----------|---------|
| **Never 0% or 100%** | Leave room for surprise |
| **Evidence moves beliefs** | Strong evidence = big shift |
| **Priors matter** | Extraordinary claims need extraordinary evidence |
| **Update incrementally** | Don't swing wildly on single data point |

---

## Calibration Check

Track your predictions. If you say "80% confident" 10 times, you should be right ~8 times.

| Stated Confidence | Should Be Right |
|-------------------|-----------------|
| 50% | 5/10 times |
| 80% | 8/10 times |
| 95% | 19/20 times |

If you're always right at 80%, you're underconfident. If rarely right, overconfident.

---

## Anti-Patterns

- **Ignoring base rates**: Rare bugs are rare, even with suspicious evidence
- **Confirmation bias**: Only seeking evidence that confirms hypothesis
- **Anchoring**: Not updating enough from prior
- **Binary thinking**: "It's either X or Y" when probability is distributed

---

## Combination

Pairs with:
- [Confidence Gates](../../../SKILL.md): Bayesian updates inform confidence levels
- [Pre-Mortem](pre-mortem.md): Assign probabilities to failure modes

---

## Provenance

Thomas Bayes (1701-1761), formalized by Pierre-Simon Laplace. Foundation of modern statistics, machine learning, and scientific reasoning.
