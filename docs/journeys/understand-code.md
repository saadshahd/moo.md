# Understand Code

You're staring at an unfamiliar codebase. You need to understand how something works, not just find where it lives.

## The Keyword

```
delve into how [X] works
```

Examples:
- "delve into how authentication works in this repo"
- "delve into how the payment flow processes refunds"
- "delve into how zod validates nested objects"

## What Happens

The delve agent activates. It's different from search:

| Search (Explore) | Understand (Delve) |
|------------------|-------------------|
| "where is X" | "how does X work" |
| Returns file paths | Returns explanations |
| Lists locations | Traces connections |

Delve traces implementations across connected components. It answers *why*, not just *where*.

## Example Session

```
You: delve into how the rate limiter works

Delve: ## Scan: rate limiter

### Answer
Rate limiting uses a sliding window algorithm in Redis.
Requests are counted per user per minute, with overflow
triggering 429 responses.

### Locations
- `src/middleware/rateLimit.ts:15-45` (RateLimiter class)
- `src/redis/client.ts:23` (increment operation)
- `src/config/limits.ts:8` (threshold constants)

### Confidence: MEDIUM
Resume for deeper investigation of the Redis interaction.
```

## Going Deeper

If confidence is LOW or MEDIUM, say:

```
go deeper
```

The agent resumes with full context, providing:
- Detailed code section analysis
- Call chain relationships
- Conclusions and gaps

## Saving for Later

Found something worth keeping?

```
save this
```

Creates `.claude/delve/[query-slug].md` for future sessions.

## When to Use Delve vs. Other Tools

| Situation | Use |
|-----------|-----|
| "Where is the auth code?" | Search/Explore |
| "How does auth validate tokens?" | **Delve** |
| "Find all files with 'user'" | Search/Explore |
| "Why does the cache invalidate here?" | **Delve** |
| "List all API endpoints" | Search/Explore |
| "Trace how a request flows through" | **Delve** |

## External Libraries

Delve can investigate open-source libraries too:

```
delve into how zod's .refine() validates async
```

It clones the library temporarily (shallow, to `/tmp/delve/`) and investigates.

---

| Say this | Get this |
|----------|----------|
| "delve into how X works" | Deep code investigation |
| "go deeper" | Resume with more detail |
| "save this" | Persist to `.claude/delve/` |

**Next:** [Build a Feature](build-feature.md) — plan with clarity before coding
