# Decision Patterns

## Reversibility Filter

Spend deep analysis only on irreversible decisions.

| Type | Rollback | Examples | Action |
|------|----------|----------|--------|
| **2A** | < 1 min | Config, rename, CSS | Execute immediately |
| **2B** | < 5 min | Dependency, refactor | Execute with monitoring |
| **1** | Hours+ | Schema, public API, data model | Deep analysis required |

### Classification Questions

1. Can I git revert in < 1 minute? → 2A
2. Does this touch external contracts? → 1
3. Can I feature-flag this? → Downgrades to 2B
4. Requires data migration? → 1

---

## Musashi Test

"Do nothing which is of no use."

1. **Can we delete instead?** What breaks if removed?
2. **Who actually uses this?** Analytics, not assumptions.
3. **Simplest version?** YAGNI ruthlessly.

---

## Atomic Migration

No v2 interfaces. No parallel implementations. One truth.

```
Cognitive Load = versions × complexity × developers
Two versions = 4x load (not 2x)
```

### Migration Protocol

1. Design new interface → approval
2. Identify all consumers
3. Update atomically (single PR)
4. Delete old interface

---

## Story Points

| Pts | Complexity | Characteristics |
|-----|------------|-----------------|
| 1 | Trivial | < 10 lines, obvious |
| 3 | Standard | Existing patterns |
| 5 | Complex | Some unknowns |
| 8 | Architecture | Multiple subsystems |
| 13+ | Too Big | Break down |

**Never time.** Complexity is objective; velocity varies.

---

## Library-First Protocol

| Domain | Library Saves | Custom Costs |
|--------|---------------|--------------|
| Auth | 6+ months | Tokens, sessions, MFA, security |
| Payments | 2+ years | PCI, fraud, disputes |
| Rate limiting | 2-4 weeks | Race conditions, distributed state |
| Email | 1-2 months | Deliverability, templates |

Every library = 1000 bugs avoided.

### Evaluation Criteria

| Criterion | Good | Bad |
|-----------|------|-----|
| Downloads | > 100k/week | < 1k/week |
| Maintenance | Commits this month | 6+ months stale |
| Security | No CVEs | Unpatched vulns |

---

## Confidence Gates

| Confidence | Action |
|------------|--------|
| **< 70%** | Research first. Surface unknowns. Don't recommend. |
| **70-85%** | Ship with monitoring and fallback plan. |
| **≥ 85%** | Ship immediately with confidence. |

### Novelty Decay

| Situation | Max Confidence |
|-----------|---------------|
| Done 3+ times | No cap |
| Done 1-2 times | 85% |
| First time, familiar tech | 70% |
| First time, new tech | 60% |
