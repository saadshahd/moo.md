# Reducing Entropy

The goal is LESS TOTAL CODE, not less effort for you.

Every line written:
- Must be maintained forever
- Can contain bugs
- Must be understood by future developers
- Adds cognitive load to the system

---

## Three Critical Questions

Before writing any code:

1. **Can we delete this?** The best code is no code
2. **Does this already exist?** Libraries > custom code
3. **Is this truly needed now?** YAGNI by default

---

## PAGNI Exceptions

Probably Are Gonna Need It. Some things ARE worth building proactively because adding them later is 10x harder:

| Category | Examples | Why Proactive |
|----------|----------|---------------|
| Security boundaries | Auth, input validation, CSRF | Retrofitting security = vulnerabilities |
| Data integrity | Foreign keys, unique indexes | Corrupt data can't be unfixed |
| Observability | Logging, metrics, tracing | Can't debug what you didn't record |
| API versioning | Version strategy, deprecation path | Breaking changes break trust |
| Schema evolution | Migration path, backward compat | Database surgery is risky |

---

## Data Over Abstractions

Prefer:
- Plain data structures over custom classes
- Configuration over code
- Tables over conditionals
- Lookup maps over switch statements

```typescript
// Entropy-adding abstraction
class PaymentProcessor {
  process(type: string) {
    switch(type) {
      case 'credit': return this.processCredit();
      case 'debit': return this.processDebit();
    }
  }
}

// Entropy-reducing data
const processors = {
  credit: processCreditPayment,
  debit: processDebitPayment,
};
processors[type](payment);
```

### Abstraction Rules

Abstractions should be:
- **Discovered** from 3+ concrete examples, not invented
- **Deletable** without cascading changes
- **Obvious** in what they hide and expose

---

## Entropy Indicators

Watch for these warning signs:

| Signal | Entropy Effect |
|--------|----------------|
| Multiple ways to do the same thing | Confusion, inconsistency |
| Unused imports/dependencies | Cognitive noise, security surface |
| Feature flags never cleaned up | Combinatorial state explosion |
| "Temporary" workarounds that persist | Technical debt compound interest |
| Documentation diverging from code | Trust erosion, onboarding friction |
| God objects or 1000+ line files | Unreadable, untestable |

---

## Delete-First Refactor

When asked to "improve" code, work in this order:

1. **Delete** - Remove dead code, unused features, obsolete paths
2. **Simplify** - Reduce nesting, flatten conditionals, inline trivial functions
3. **Consolidate** - Merge duplicates, extract shared patterns
4. **Add** - Only as last resort, and only what's proven necessary

Each step should reduce line count. If your refactor adds lines, justify why.

---

## Anti-Patterns

| Pattern | Entropy Cost | Better Alternative |
|---------|--------------|-------------------|
| "Just in case" code | Maintenance for imaginary scenarios | Delete, add when needed |
| Premature abstraction | Complexity without proven need | Wait for 3 examples |
| Copy-paste proliferation | Bug multiplication | Extract after 2nd copy |
| Framework worship | Dependencies you don't control | Evaluate actual need |
| Config sprawl | Combinatorial explosion | Sensible defaults |
| Version suffixes (v2, new_) | Parallel code paths | Atomic migration |

---

## Quantifying Entropy

When evaluating changes, ask:

- **Lines added vs removed?** Net negative is usually better
- **Dependencies added?** Each one is future maintenance
- **States possible?** Fewer valid states = fewer bugs
- **Concepts introduced?** Each concept = cognitive load
- **Files touched?** Scattered changes = harder reviews

---

## Application

This mindset applies to:

- **Workflow A (Build):** Question every component before adding
- **Workflow B (Debug):** Delete the bug's preconditions, not just symptoms
- **Workflow C (Refactor):** Deletion is the goal, not reorganization

When Library-First Protocol finds nothing, ask: "Do we need this at all?"
