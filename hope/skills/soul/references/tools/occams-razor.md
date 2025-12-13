# Occam's Razor

When facing competing explanations, prefer the one with fewer assumptions.

---

## When to Use

- Debugging: multiple possible causes
- Architecture: choosing between designs
- Decisions: evaluating complex vs simple solutions
- Hypothesis formation: which explanation to test first

---

## The Framework

1. **List** all possible explanations/solutions
2. **Count** assumptions required for each
3. **Prefer** explanation with fewest assumptions
4. **Validate** against evidence before committing

### Example

Bug in production. Two theories:

| Theory | Assumptions |
|--------|-------------|
| Database timeout | 1: DB is slow |
| Race condition + cache invalidation + network partition | 3: multiple failures aligned |

**Start with the simpler theory.** Check DB metrics first.

---

## Anti-Patterns

- **Oversimplifying**: Ignoring necessary complexity. "It's probably fine" isn't Occam's Razor.
- **Confusing simple with easy**: Simple solutions may be hard to implement.
- **Ignoring evidence**: If evidence points to complex cause, follow the evidence.

---

## Combination

Pairs well with:
- [First Principles](first-principles.md): Break down, then simplify
- [Issue Trees](issue-trees.md): Structure possibilities before applying razor

---

## Provenance

William of Ockham, 14th century Franciscan friar. "Entities should not be multiplied beyond necessity." Widely adopted in science, medicine, engineering, and philosophy.
