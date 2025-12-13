# Feedback Loops

Understand balancing and reinforcing system dynamics.

## When to Use

| Trigger                             | Use This Tool              |
| ----------------------------------- | -------------------------- |
| System behavior seems unpredictable | Map the loops              |
| Growth accelerating or collapsing   | Identify reinforcing loops |
| System resisting change             | Find balancing loops       |

## The Framework

### Reinforcing Loop (R) — Amplifies Change

```
      ┌─────────────────┐
      │                 │
      ▼                 │
 ┌─────────┐       ┌────┴────┐
 │ Growth  │──────▶│ Success │
 └─────────┘       └─────────┘
      │                 ▲
      │    (R)          │
      └─────────────────┘

More growth → more success → more growth → ...
(virtuous cycle or death spiral)
```

### Balancing Loop (B) — Resists Change

```
      ┌─────────────────┐
      │        (B)      │
      ▼                 │
 ┌─────────┐       ┌────┴────┐
 │  Gap    │──────▶│ Action  │
 └─────────┘       └─────────┘
      ▲                 │
      │                 │
      └────── Goal ─────┘

Gap detected → action taken → gap closes → action stops
(thermostat behavior)
```

## Loop Types

| Type                | Behavior                       | Example                                           |
| ------------------- | ------------------------------ | ------------------------------------------------- |
| **Reinforcing (+)** | Exponential growth or collapse | Word of mouth → users → more word of mouth        |
| **Balancing (-)**   | Goal-seeking, stabilization    | Bug rate → hire QA → bug rate drops → stop hiring |

## How to Apply

1. **Identify the variable** you're trying to understand
2. **Trace what it affects** (arrows out)
3. **Trace what affects it** (arrows in)
4. **Label loops:** Does increase cause more increase (R) or pushback (B)?
5. **Find leverage points:** Where can small change shift behavior?

## Example

**System:** Engineering team velocity

```
                    ┌──────────────────────┐
                    │                      │
                    ▼                      │
              ┌──────────┐           ┌─────┴─────┐
              │ Tech Debt│───────────│ Shortcuts │
              └────┬─────┘    (R1)   └───────────┘
                   │ Death Spiral          ▲
                   │                       │
                   ▼                       │
              ┌──────────┐                 │
              │ Velocity │────── Pressure ─┘
              │  Drops   │
              └────┬─────┘
                   │
                   ▼
              ┌──────────┐           ┌───────────┐
              │  Hire    │───────────│ Onboarding│
              │  More    │    (B1)   │   Load    │
              └──────────┘ Stabilizer└───────────┘
```

**Reading the diagram:**

- (R1) Death Spiral: Shortcuts → more debt → slower → more pressure → more shortcuts
- (B1) Stabilizer: Slow velocity → hire → onboarding load → velocity stays flat

**Leverage point:** Break R1 by allocating 20% to debt paydown
