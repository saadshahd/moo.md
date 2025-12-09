# Debug a Problem

Something's broken. You need the root cause, not a band-aid.

## The Keyword

```
/hope:debug "describe the problem"
```

Examples:
- "/hope:debug 'API returns 500 on POST /users'"
- "/hope:debug 'tests pass locally but fail in CI'"
- "/hope:debug 'memory usage spikes after 2 hours'"

## What Happens

The system follows a strict path: Effect → Cause → Root → Fix → Prevent.

No workarounds. No "try this and see." Find the actual cause.

## The Phases

### Phase 1: Understand the Symptom

If anything's unclear, you'll get questions:
- What's the exact error?
- When did this start?
- What changed recently?
- Can you reproduce it?

### Phase 2: Five Whys

The system brainstorms potential root causes with confidence levels:

```
## Potential Root Causes
1. Race condition in async handler: 60-70% - timing-dependent
2. Database connection pool exhausted: 40-50% - no pool metrics
3. Memory leak in cache: 30-40% - would expect OOM errors
```

Then asks "Why?" repeatedly until reaching the true root.

### Phase 3: Verify

Before any fix:
- Minimal reproduction
- Evidence (logs, debugger, profiling)
- ≥70% confidence in root cause

**All hypotheses < 70%?** → Add instrumentation first.

### Phase 4: Fix + Prevent

```
## Root Cause (75-80% confident)
Connection pool exhausted because default size (10) can't handle
burst traffic. Pool waits indefinitely, causing request timeout.

## Fix
src/db/pool.ts:15 - increase pool size to 50, add 30s acquire timeout

## Prevention
Add pool metrics to monitoring dashboard. Alert at 80% utilization.
```

## Example Session

```
You: /hope:debug "checkout fails intermittently with 'payment timeout'"

System: Before debugging, I need:
1. How often does this happen? (1%, 10%, 50% of checkouts?)
2. Any pattern? (time of day, specific products, user segments?)
3. What do the payment provider logs show?

You: ~5% of checkouts, seems random, Stripe logs show request never arrived

System: ## Potential Root Causes
1. Network timeout before reaching Stripe: 50-60%
2. Request queued behind slow operation: 30-40%
3. DNS resolution delay: 20-30%

Let me investigate the first hypothesis...

[traces code, finds synchronous validation blocking]

## Verified Root Cause (80-85%)
Synchronous address validation blocks the event loop for 2-3s.
Under load, Stripe requests queue behind validation and timeout.

## Fix
src/checkout/validate.ts:45 - make validation async, run in parallel

## Prevention
Add event loop lag monitoring. Alert if > 100ms.

---
Confidence: 80-85%
Reversible: Type 2B
Complexity: 3 story points
```

## The Key Discipline

**Workarounds are forbidden.**

"Just add a retry" doesn't fix the bug. It hides it. The system forces you to find the actual cause.

## When Confidence Is Low

If all hypotheses are < 70%, the system will ask you to:

1. Add logging/instrumentation
2. Gather more evidence
3. Create minimal reproduction

Only then proceed to fix.

---

| Say this | Get this |
|----------|----------|
| "/hope:debug 'problem'" | Root cause analysis |
| "add instrumentation" | Logging plan before fix |
| "proceed with fix" | Implementation after verification |

**Next:** [Write a PRD](write-prd.md) — requirements that don't drift
