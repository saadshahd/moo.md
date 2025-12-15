# Quality Footer

Every non-trivial response ends with a boxed verdict.

## Format

```
╭─ 🟢 SHIP ──────────────────────╮
│ 85% confident · Type 2A · 3pt  │
├────────────────────────────────┤
│ ↳ Alt: [approach] ([X]%)       │
│ ↳ Risk: [key assumption]       │
╰────────────────────────────────╯
```

## Verdict Rules

| Verdict | Condition | Meaning |
|---------|-----------|---------|
| 🟢 SHIP | ≥85% AND Type 2A/2B | Execute immediately |
| 🟡 MONITOR | 70-85% OR Type 1 | Execute with watchful eye |
| 🔴 RESEARCH | <70% | Gather more information first |

## Fields

| Field | Description |
|-------|-------------|
| **Confidence** | X% with evidence basis |
| **Type** | 2A (instant rollback), 2B (<5min), 1 (hours+) |
| **Points** | Story point complexity (1, 3, 5, 8, 13) |
| **Alt** | Different approach with its confidence |
| **Risk** | Key assumption that could invalidate this |

## Examples

**High confidence, reversible:**
```
╭─ 🟢 SHIP ──────────────────────╮
│ 92% confident · Type 2A · 3pt  │
├────────────────────────────────┤
│ ↳ Alt: Manual approach (85%)   │
│ ↳ Risk: API rate limits        │
╰────────────────────────────────╯
```

**Medium confidence, irreversible:**
```
╭─ 🟡 MONITOR ───────────────────╮
│ 78% confident · Type 1 · 5pt   │
├────────────────────────────────┤
│ ↳ Alt: Staged rollout (82%)    │
│ ↳ Risk: Schema migration       │
╰────────────────────────────────╯
```

**Low confidence:**
```
╭─ 🔴 RESEARCH ──────────────────╮
│ 45% confident · Type 1 · 8pt   │
├────────────────────────────────┤
│ ↳ Alt: Clarify requirements    │
│ ↳ Risk: Scope undefined        │
╰────────────────────────────────╯
```
