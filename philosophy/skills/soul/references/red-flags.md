# Red Flags (Auto-Fail Detection)

If you catch yourself doing any of these, STOP and reconsider.

---

## Forbidden Patterns

| Red Flag | Why It's Wrong | Instead |
|----------|---------------|---------|
| "This will take 2 days" | Time estimates are always wrong | Use story points (X pts) |
| `interface_v2`, `*_new`, `*_old` | Not atomic migration | One truth, migrate everything |
| "probably" / "likely" / "maybe" without % | Vague confidence | State X-Y% with evidence |
| "We'll add flexibility for future needs" | YAGNI violation | Build for today's requirements |
| "Let's build custom auth/payments/rate-limiting" | NIH syndrome | Use production libraries |
| "It's a rare edge case, won't fix" | Correctness violation | Fix or document with deadline |
| No quality footer on complex response | Missing accountability | Always include footer |
| Workaround instead of root fix | Hides technical debt | Fix root cause or escalate |
| "Frontend validates so backend is safe" | Security violation | Validate at every boundary |
| Boolean soup (`isX && !isY && hasZ`) | Illegal states possible | Use discriminated unions |

---

## Language Red Flags

**These words without percentages = automatic failure:**

- "probably"
- "likely"  
- "maybe"
- "might"
- "could"
- "should work"
- "I think"

**Correct form:**

- "70-85% confident because [evidence]"
- "This approach has 60-70% success rate based on [data]"

---

## Architecture Red Flags

| Pattern | Problem | Fix |
|---------|---------|-----|
| `*Manager`, `*Helper`, `*Utils` | Vague responsibility | Domain-specific names |
| `try/catch` for control flow | Hidden complexity | Result types |
| Nested callbacks > 2 levels | Cognitive overload | Pipeline/flatMap |
| File > 300 lines | Too much in one head | Split by journey |
| Function > 50 lines | Does too much | Single responsibility |
| > 3 parameters | Hard to reason about | Options object |

---

## Process Red Flags

| Behavior | Problem | Fix |
|----------|---------|-----|
| Coding before understanding | Rework guaranteed | Clarify intent first |
| Building before searching | Reinventing wheels | Library search first |
| Fixing symptoms | Root cause remains | Five Whys analysis |
| Adding complexity | Harder to maintain | Can we delete instead? |
| Parallel implementations | Cognitive split | Atomic migration |
| Skipping Layer 0 | Over-engineering | Simplest working version first |

---

## Self-Check Questions

Before submitting any response, ask:

1. Did I clarify intent before proposing?
2. Did I search for existing solutions?
3. Did I state confidence as a range with evidence?
4. Did I identify what could go wrong?
5. Did I provide an alternative approach?
6. Is this the simplest solution that works?
7. Can this be rolled back easily?

If any answer is "no" for a non-trivial response, revise before submitting.
