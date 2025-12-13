# Minto Pyramid

Structure communication for maximum clarity and impact.

## When to Use

| Trigger                         | Use This Tool            |
| ------------------------------- | ------------------------ |
| Writing executive summary       | Lead with conclusion     |
| Presenting to busy stakeholders | Respect their time       |
| Complex topic needs explanation | Structure hierarchically |

## The Framework

```
                    ┌─────────────────┐
                    │   ANSWER        │  ← Start here
                    │   (So what?)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌─────────┐    ┌─────────┐    ┌─────────┐
        │ Reason  │    │ Reason  │    │ Reason  │
        │    1    │    │    2    │    │    3    │
        └────┬────┘    └────┬────┘    └────┬────┘
             │              │              │
       ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
       │ Evidence  │  │ Evidence  │  │ Evidence  │
       └───────────┘  └───────────┘  └───────────┘

    Top-down: Conclusion → Supporting reasons → Evidence
```

## SCQA Framework

| Element          | Question                              | Purpose                        |
| ---------------- | ------------------------------------- | ------------------------------ |
| **S**ituation    | What's the context?                   | Establish shared understanding |
| **C**omplication | What changed? What's the problem?     | Create tension                 |
| **Q**uestion     | What do we need to decide/understand? | Focus attention                |
| **A**nswer       | What's the recommendation?            | Deliver the insight            |

## How to Apply

1. **Start with the answer:** What's your main point?
2. **Group supporting reasons:** Why should they believe you? (3 max)
3. **Add evidence under each reason:** Data, examples, logic
4. **Write top-down:** Answer first, then reasons, then evidence
5. **Remove anything that doesn't support the answer**

## Example

**Topic:** We should migrate to TypeScript

```
SCQA Setup:
┌─────────────────────────────────────────────────────────┐
│ SITUATION: We have 200k lines of JavaScript             │
│ COMPLICATION: Type errors cause 30% of production bugs  │
│ QUESTION: How do we reduce type-related bugs?           │
│ ANSWER: Migrate to TypeScript over 6 months             │
└─────────────────────────────────────────────────────────┘

Pyramid:
                ┌────────────────────────────┐
                │ Migrate to TypeScript      │
                │ (reduces bugs 40%)         │
                └─────────────┬──────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   ┌───────────┐        ┌───────────┐        ┌─────────────┐
   │ Catches   │        │ Improves  │        │ Incremental │
   │ errors at │        │ IDE       │        │ adoption    │
   │ compile   │        │ support   │        │ possible    │
   └─────┬─────┘        └─────┬─────┘        └─────┬───────┘
         │                    │                    │
   "Team X reduced"     "Autocomplete"      "File-by-file"
   "bugs 40% after"     "cut dev time"      "migration"
   "TS migration"       "by 20%"            "path exists"
```

**Resulting email:**

> We should migrate to TypeScript over 6 months.
>
> This will reduce type-related production bugs by ~40% (based on Team X's results), while improving developer productivity through better IDE support. The migration can happen incrementally, file-by-file, without blocking feature work.

## Key Insight

Most people write bottom-up (evidence → conclusion). Busy readers need top-down (conclusion → evidence). They can stop reading when they have enough.

---

*Source: Barbara Minto, McKinsey 1970s*
