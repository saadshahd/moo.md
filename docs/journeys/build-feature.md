# Build a Feature

You have a feature to build. Before writing code, get clarity.

## The Keyword

```
plan building [X]
```

Or use the command directly:

```
/hope:plan "add user authentication with OAuth"
```

Examples:
- "plan building a rate limiter for the API"
- "plan building a notification system"
- "/hope:plan 'migrate from REST to GraphQL'"

## What Happens

The system won't let you build until intent is clear. It runs through phases:

1. **Surface unknowns** — What's unclear? What could fail?
2. **Ask questions** — If confidence < 85%, you'll get targeted questions
3. **Search libraries** — Prior art before custom code
4. **Present plan** — Structured proposal with confidence rating

## Example Session

```
You: plan building a caching layer for API responses

System: Before I plan, I need to clarify:

1. What's the read/write ratio you expect?
2. Should cache invalidation be time-based or event-based?
3. Any constraints on infrastructure (Redis available? Memory limits?)
4. What's the acceptable staleness window?

You: 90% reads, event-based invalidation, Redis is available,
     30 seconds staleness is fine

System: ## Intent
Add Redis caching for API responses with event-based invalidation.

## Approach: Layer 0
Use ioredis with 30s TTL, pub/sub for invalidation events.

## Failure Modes
- Cache stampede on cold start: MEDIUM - use probabilistic early expiry
- Redis connection failure: HIGH - fallback to direct DB with circuit breaker

## Success Criteria
- p99 latency drops 50%+
- Cache hit rate > 80% after warmup

---
Confidence: 75-80% (first time implementing in this codebase)
Alternative: In-memory LRU if Redis adds too much complexity
Reversible: Type 2B (can remove caching layer cleanly)
Complexity: 5 story points
```

## The Key Discipline

**The system will not proceed until you say "proceed".**

This is intentional. Planning is thinking. Rushing past it costs more later.

## When to Use Plan vs. Just Code

| Situation | Approach |
|-----------|----------|
| < 3 story points, clear path | Just code |
| Unfamiliar territory | **Plan first** |
| Multiple valid approaches | **Plan first** |
| Will touch > 3 files | **Plan first** |
| Has failure modes | **Plan first** |

## What the Plan Includes

Every plan ends with a quality footer:

```
Confidence: X-Y% (evidence: [specific])
Alternative: [different approach] (X-Y%)
Reversible: Type [2A/2B/1]
Complexity: X story points
```

- **Confidence** — Percentage, not "probably"
- **Alternative** — Always one backup approach
- **Reversible** — How hard to undo (2A = trivial, 1 = hard)
- **Complexity** — Story points, never time estimates

---

| Say this | Get this |
|----------|----------|
| "plan building X" | Intent clarification + structured plan |
| "proceed" | Start implementation |
| "what about Y?" | Plan revision |

**Next:** [Debug a Problem](debug-problem.md) — root cause, not workaround
