# Cost Controls

## Limits

| Protection | Default | Max | Override |
|------------|---------|-----|----------|
| Budget cap | $25 | $100 | `--budget=N` |
| Iteration limit | 10 | 50 | `--iterations=N` |
| Same error | 3x | — | Circuit breaker |
| Same file edits | 5x | — | Circuit breaker |

## Override Syntax

```
/loop --budget=50 --iterations=20 [spec]
```

Overrides persist for the current loop only.

## Circuit Breakers

**Same Error (3x):**
- Tracks error signatures (message + location)
- Three identical errors → pause
- Prevents infinite retry loops

**Same File (5x):**
- Tracks file edit count per iteration
- Five edits to same file → pause
- Indicates possible thrashing or unclear requirements

## On Limit Hit

**Pause, don't kill.** Always:

1. Save current state to task metadata
2. Output what was accomplished
3. Explain why paused (budget, iterations, circuit breaker)
4. Provide resume command: `/loop continue`

## Budget Tracking

Cost accumulated per iteration based on:
- Input tokens processed
- Output tokens generated
- Tool calls made

Rough estimates used; actual billing may vary.

## Continuation

After pause, user can:

| Command | Effect |
|---------|--------|
| `/loop continue` | Resume with same limits |
| `/loop continue --budget=25` | Add $25 more budget |
| `/loop cancel` | Terminate, mark incomplete |

State preserved in Tasks API until explicit cancel or completion.
