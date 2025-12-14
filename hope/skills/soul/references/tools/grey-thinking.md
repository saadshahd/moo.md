# Grey Thinking

Reality exists in shades of grey. The dose makes the poison.

## When to Use

| Trigger                              | Use This Tool                |
| ------------------------------------ | ---------------------------- |
| "X is always bad"                    | Binary framing detected      |
| "There's no middle ground"           | Force nuanced thinking       |
| Heated policy debate                 | Escape false dichotomy       |
| Catch yourself saying "never/always" | Check for oversimplification |

## The Framework

```
    BINARY THINKING                   GREY THINKING
    ──────────────                    ─────────────

    ┌─────┐     ┌─────┐              ┌─────────────────────────┐
    │GOOD │     │ BAD │              │ ◀─────────────────────▶ │
    └─────┘     └─────┘              │         Context         │
                                     │         matters         │
         Either/Or                   └─────────────────────────┘
                                              Continuum

    "Technical debt is bad"           "Some debt is strategic,
                                       some is toxic—depends
                                       on interest rate"

    "Meetings are waste"              "Meetings have ROI.
                                       Some are 10x, some 0.1x"

    "Microservices > Monolith"        "At what scale? What team
                                       size? What rate of change?"
```

**The Paracelsus Principle:**

> "The dose makes the poison."
> Water kills at 6 liters. Arsenic is safe at trace amounts.
> Everything depends on quantity and context.

## How to Apply

**The Grey Thinking Process:**

1. **DETECT** — Is this being framed as binary?

   - Listen for: "always", "never", "either/or", "good/bad"
   - Notice: Heated debate often signals false dichotomy

2. **CONTINUUM** — Place on spectrum

   - Where exactly does this fall? 30% bad? 70% good?
   - What would move it left or right?

3. **DOSE** — At what scale does it become problematic?

   - Small amounts: effect?
   - Large amounts: effect?
   - Threshold: where does it flip?

4. **CONTEXT** — What conditions change the evaluation?

   - In situation A: good or bad?
   - In situation B: different answer?
   - For person/team X vs Y?

5. **STEELMAN BOTH** — Strongest case for each pole

   - Best argument for "always good"?
   - Best argument for "always bad"?
   - Both positions have kernels of truth

6. **INTEGRATE** — Find the nuanced position
   - "It depends on..." (specify exactly what)
   - "Good when X, bad when Y"
   - "The dose matters"

## Triggers (automatic detection)

When you hear or think:

- "X is always bad/good"
- "You either have Y or you don't"
- "This is black and white"
- "There's only two options"
- "You're either with us or against us"
- "That's just wrong/right"

## Anti-Patterns

**False dichotomy:**

- "Either we ship fast or we write tests"
- Reality: Testing speed varies; ROI varies by test type

**Slippery slope:**

- "If we allow X, soon it'll be Y"
- Reality: Mechanisms exist to stop at reasonable points

**Slogans replacing thinking:**

- "Move fast and break things"
- "Slow is smooth, smooth is fast"
- Both can be true depending on context

## Example

**Situation:** Team debate about code comments

```
Binary positions:
───────────────────────────────────────────
Position A: "Comments are code smell.
            Code should be self-documenting."

Position B: "Always comment your code.
            Future readers need context."
───────────────────────────────────────────

Grey thinking process:
───────────────────────────────────────────
1. DETECT: Binary framing ("always", "never")

2. CONTINUUM: Where does commenting fall?
   - Obvious code: comments redundant (0% value)
   - Complex algorithms: comments essential (100% value)
   - Business logic: comments explain WHY (80% value)

3. DOSE: When does it become problematic?
   - Too few: code archeology required
   - Too many: noise, rot, maintenance burden
   - Sweet spot: comment the WHY, not the WHAT

4. CONTEXT: What changes the answer?
   - Team tenure: new team needs more context
   - Code churn: high churn = comment rot
   - Complexity: O(n²) algorithm needs explanation

5. STEELMAN BOTH:
   - "Self-documenting": Forces better naming,
     prevents comment rot, reduces maintenance
   - "Comment everything": Preserves intent,
     helps onboarding, documents decisions

6. INTEGRATE: "Comment the why, not the what.
   Business rules and non-obvious decisions
   get comments. Implementation details don't.
   Review comments for rot quarterly."
───────────────────────────────────────────
```

---

## Combination

Pairs well with:

- [Steel Man](steel-man.md): Strengthen both sides before integrating
- [Bayesian Thinking](bayesian-thinking.md): Probability over certainty
- [Decision Matrix](decision-matrix.md): Score on continuum, not binary

---

_Source: Paracelsus (16th century); Farnam Street "The Value of Grey Thinking"_
