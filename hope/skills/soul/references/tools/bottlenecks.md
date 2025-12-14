# Bottlenecks (Theory of Constraints)

Find and exploit the single constraint limiting throughput.

## When to Use

| Trigger                         | Use This Tool                   |
| ------------------------------- | ------------------------------- |
| "Everything is slow"            | Find the one binding constraint |
| Optimizing without improvement  | You're fixing the wrong thing   |
| System underperforming capacity | Constraint is hidden elsewhere  |

## The Framework

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  "A chain is only as strong as its weakest link."       │
│                                                         │
│  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐        │
│  │ 100 │──▶│ 80  │──▶│ 40  │──▶│ 90  │──▶│ 70  │        │
│  └─────┘   └─────┘   └─────┘   └─────┘   └─────┘        │
│                         ▲                               │
│                         │                               │
│                    BOTTLENECK                           │
│               (System throughput = 40)                  │
│                                                         │
│  Improving any step EXCEPT the bottleneck = waste       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## The Five Focusing Steps

| Step               | Action                         | Question to Ask                   |
| ------------------ | ------------------------------ | --------------------------------- |
| **1. IDENTIFY**    | Find the constraint            | What limits our throughput?       |
| **2. EXPLOIT**     | Maximize constraint's output   | How do we get 100% from it?       |
| **3. SUBORDINATE** | Align everything else to it    | What should slow down to help?    |
| **4. ELEVATE**     | Increase constraint's capacity | What investment breaks the limit? |
| **5. REPEAT**      | Find the new constraint        | Where did the bottleneck move?    |

## How to Apply

1. **Map the flow** from input to output (value stream)
2. **Measure throughput** at each step
3. **Find the lowest** number — that's your constraint
4. **Ask:** Is this constraint being fully utilized?
5. **Protect the constraint:** Buffer before it, never let it starve
6. **Improve the constraint first** — everything else is secondary

## Constraint Types

| Type          | Example                      | Intervention                       |
| ------------- | ---------------------------- | ---------------------------------- |
| **Physical**  | Machine, server, person      | Add capacity, optimize utilization |
| **Policy**    | Approval process, batch size | Change the rule                    |
| **Market**    | Not enough demand            | Improve product/marketing          |
| **Knowledge** | Team doesn't know how        | Training, hiring                   |

## Example

**Problem:** Feature delivery taking 3 weeks despite available developers

```
Value Stream Analysis:
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  STEP              CAPACITY    ACTUAL    WAIT TIME      │
│  ─────────────     ────────    ──────    ─────────      │
│  Development       5/week      2/week    0 days         │
│  Code Review       3/week      2/week    3 days  ◀──    │
│  QA Testing        4/week      2/week    5 days         │
│  Deployment        10/week     2/week    0 days         │
│                                                         │
│  BOTTLENECK: Code Review (only 2 senior devs can do it) │
│                                                         │
└─────────────────────────────────────────────────────────┘

Five Steps Applied:
1. IDENTIFY: Code review is the constraint
2. EXPLOIT: Reviewers do ONLY reviews, no other meetings
3. SUBORDINATE: Developers batch PRs, reduce review load
4. ELEVATE: Train 2 more reviewers, enable self-review for small PRs
5. REPEAT: QA is now the bottleneck — address next
```

**Key Insight:** Improving development speed (non-constraint) would just create more queue before code review. Focus only on the bottleneck.

---

_Source: Eliyahu Goldratt, "The Goal" 1984_
