# Common Rationalizations (All Wrong)

Every rationalization is a skipped step. Skipped steps compound into failures.

## The Rationalizations

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Run Silent Audit anyway. |
| "I already know the answer" | State confidence percentage. |
| "This doesn't need a library search" | Search anyway. Every library not written = 1000 bugs avoided. |
| "The user wants me to just do it" | Clarify intent first. Wrong fast = waste. |
| "This is too small for workflows" | Workflow B for any fix. |
| "I can skip the inversion" | Inversion catches failures cheaper than debugging. |
| "The pattern is obvious" | Document it anyway. Future you will forget. |
| "I'll add tests later" | "Later" = never. Test now or don't claim done. |
| "This doesn't need verification" | Assumption-only verification blocks SHIP. |
| "The user will catch any issues" | You own the quality. Don't shift responsibility. |

## Why Rationalizations Happen

1. **Time pressure** → Shortcuts feel faster (they're not)
2. **Overconfidence** → "I've done this before" ignores context differences
3. **Scope blindness** → Small tasks seem not worth the overhead
4. **Process fatigue** → Checklists feel bureaucratic

## The Cost

```
Rationalization → Skipped step → Unverified assumption → Bug
                                                      → Rework
                                                      → Trust erosion
```

Each skip compounds:
- First skip: 10% failure chance
- Second skip: 20% failure chance
- Third skip: 35% failure chance
- Cumulative: 1 - (0.9 × 0.8 × 0.65) = 53% failure chance

## Counter-Moves

| Rationalization | Counter |
|-----------------|---------|
| "Just a simple question" | "Simple questions have simple audits" |
| "I already know" | "If I'm sure, stating % costs nothing" |
| "No library needed" | "5 minutes to search, 5 days to debug custom" |
| "User wants speed" | "User wants correct. Speed × wrong = waste" |
| "Too small" | "Small enough to do right quickly" |
| "Skip inversion" | "Inversion is 2 minutes, debugging is 2 hours" |
| "Pattern obvious" | "Obvious patterns still need evidence" |
| "Tests later" | "No tests = not done" |

## Recognition Signals

You're rationalizing when:
- You feel resistance to a step
- You're justifying why THIS case is different
- You're using words like "just", "only", "quick"
- You're imagining the user's impatience
- You want to skip to the "interesting" part

**Recognition → Pause → Execute the step anyway**
