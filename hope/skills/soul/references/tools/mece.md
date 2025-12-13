# MECE Principle

Mutually Exclusive, Collectively Exhaustive — categories that don't overlap and cover everything.

---

## When to Use

- Breaking down problems
- Issue trees and hypothesis generation
- Requirements gathering
- Organizing information
- Root cause analysis
- Presentation structure

---

## The Framework

For any categorization:

| Criterion | Meaning | Test |
|-----------|---------|------|
| **Mutually Exclusive** | No overlap between categories | Can any item fit in multiple buckets? |
| **Collectively Exhaustive** | Everything is covered | Is anything left out? |

### MECE Checklist

- [ ] Every item fits in exactly one category
- [ ] All possible items are accounted for
- [ ] Categories are at the same level of abstraction
- [ ] No gaps between categories

---

## Examples

### MECE

| Categorization | Why MECE |
|----------------|----------|
| Age: 0-17, 18-64, 65+ | No overlap, covers everyone |
| Numbers: Odd, Even | Mutually exclusive, all numbers covered |
| Revenue: Product A, Product B, Product C | If these are all products |

### NOT MECE

| Categorization | Problem |
|----------------|---------|
| Students, Employees | Overlap (student employees) |
| North America, Europe, Asia | Not exhaustive (missing Africa, etc.) |
| Small, Large | Gap (what about medium?) |

---

## Application: Issue Tree

```
Why is revenue down?
├── Volume down (fewer sales)
│   ├── Fewer leads
│   └── Lower conversion
└── Price down (lower per-sale revenue)
    ├── Discounting
    └── Product mix shift
```

Each branch is mutually exclusive; together they're exhaustive.

---

## Anti-Patterns

- **Forcing MECE on non-MECE data**: Some things genuinely overlap
- **Arbitrary categories**: MECE doesn't mean useful
- **Ignoring practicality**: Perfect MECE may not be actionable

---

## Pronunciation

Pronounced "me-see" (though creator Barbara Minto preferred "meece").

---

## Provenance

Barbara Minto, McKinsey & Company, late 1960s. Underlies the Minto Pyramid Principle. Traces conceptually to Aristotle's categories.
