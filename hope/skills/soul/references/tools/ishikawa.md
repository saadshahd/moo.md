# Ishikawa Diagram (Fishbone)

Identify root causes by categorizing contributing factors.

## When to Use

| Trigger                           | Use This Tool             |
| --------------------------------- | ------------------------- |
| Bug with multiple possible causes | Map all factors visually  |
| Incident post-mortem              | Ensure no category missed |
| Complex failure analysis          | Structure brainstorming   |

## The Framework

```
        Methods ─────────┐    ┌───────── People
           │             │    │             │
    "No code review"     │    │    "New hire"
    "Missing tests"      │    │    "Unclear ownership"
                         │    │
                         ▼    ▼
                    ┌──────────────┐
                    │    EFFECT    │
                    │  [Problem]   │
                    └──────────────┘
                         ▲    ▲
                         │    │
    "Legacy system"      │    │    "High traffic"
    "No monitoring"      │    │    "Friday deploy"
           │             │    │             │
     Machines ───────────┘    └───────── Environment
```

## The 6 M's (Categories)

| Category          | What to Examine                           |
| ----------------- | ----------------------------------------- |
| **Methods**       | Processes, procedures, documentation      |
| **Machines**      | Tools, infrastructure, equipment          |
| **Materials**     | Inputs, data quality, dependencies        |
| **Measurements**  | Metrics, monitoring, observability        |
| **Mother Nature** | Environment, external factors, timing     |
| **Manpower**      | People, training, communication, workload |

## How to Apply

1. Write the EFFECT (problem) in the box on the right
2. Draw the main spine with 4-6 category branches
3. Brainstorm causes for each category (no filtering yet)
4. Ask "why?" for each cause to find deeper factors
5. Identify the 2-3 most likely root causes to investigate

## Example

**Effect:** API timeout errors spike every Monday morning

```
        Methods ─────────┐    ┌───────── People
           │             │    │             │
    "No cache warming"   │    │    "Weekend on-call gaps"
    "Batch jobs at 8am"  │    │    "No handoff process"
                         │    │
                         ▼    ▼
                    ┌──────────────┐
                    │   Monday AM  │
                    │   Timeouts   │
                    └──────────────┘
                         ▲    ▲
                         │    │
    "Cold DB replicas"   │    │    "Marketing emails"
    "Stale connections"  │    │    "Traffic 3x baseline"
           │             │    │             │
     Machines ───────────┘    └───────── Environment
```

**Root causes to investigate:** Cold caches + Monday traffic spike
