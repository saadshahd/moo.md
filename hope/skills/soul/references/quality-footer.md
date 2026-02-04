# Quality Footer

**MANDATORY:** EVERY response MUST end with a boxed verdict.
Verdicts advise — they flag concerns but don't block the user.

## Format

```
╭─ 🟢 SHIP ──────────────────────────╮
│ Verified: execution output         │
│ Checklist: 4/4 workflow items      │
│ Subjective: ~85% · Type 2A · 3pt   │
├────────────────────────────────────┤
│ ↳ Alt: [approach] (code review)    │
│ ↳ Risk: [key assumption]           │
╰────────────────────────────────────╯
```

## Verification Types

Listed in order of reliability:

| Type | Description | Sufficient for SHIP? |
|------|-------------|---------------------|
| `execution output` | Ran command, showed result | ✓ Yes |
| `observation` | Screenshot, debugger session | ✓ Yes |
| `measurement` | Metrics, benchmark data | ✓ Yes |
| `code review` | Inspection only | ⚠️ Weak |
| `assumption` | Not verified | ⚠️ Flag with warning |

## Verdict Rules

| Verdict | Condition | Meaning |
|---------|-----------|---------|
| 🟢 SHIP | Verified (not assumption) AND Type 2A/2B | Execute immediately |
| 🟡 MONITOR | Verified + Type 1 OR code review only | Execute with watchful eye |
| 🔴 RESEARCH | Subjective <70% OR no verification plan | Gather more information first |

## Fields

| Field | Description |
|-------|-------------|
| **Verified** | Verification type (primary signal) |
| **Checklist** | Workflow items satisfied (e.g., 4/4) |
| **Subjective** | Estimate with evidence basis (labeled honestly) |
| **Type** | 2A (instant rollback), 2B (<5min), 1 (hours+) |
| **Points** | Story point complexity (1, 3, 5, 8, 13) |
| **Alt** | Different approach with its verification type |
| **Risk** | Key assumption that could invalidate this |

## Examples

**High verification, reversible:**
```
╭─ 🟢 SHIP ──────────────────────────╮
│ Verified: execution output         │
│ Checklist: 4/4 workflow items      │
│ Subjective: ~92% · Type 2A · 3pt   │
├────────────────────────────────────┤
│ ↳ Alt: Manual approach (observation)│
│ ↳ Risk: API rate limits            │
╰────────────────────────────────────╯
```

**Code review only, irreversible:**
```
╭─ 🟡 MONITOR ───────────────────────╮
│ Verified: code review              │
│ Checklist: 3/4 workflow items      │
│ Subjective: ~78% · Type 1 · 5pt    │
├────────────────────────────────────┤
│ ↳ Alt: Staged rollout (observation)│
│ ↳ Risk: Schema migration           │
╰────────────────────────────────────╯
```

**Unverified (flags warning):**
```
╭─ 🔴 RESEARCH ──────────────────────╮
│ Verified: assumption               │
│ Checklist: 1/4 workflow items      │
│ Subjective: ~45% · Type 1 · 8pt    │
├────────────────────────────────────┤
│ ↳ Alt: Clarify requirements        │
│ ↳ Risk: Scope undefined            │
╰────────────────────────────────────╯
```

## Why This Format

Research shows self-reported confidence percentages are systematically inflated (80-100% range). The verification type is an extrinsic signal that research validates. By showing both:

1. **Verified** (primary) — What evidence exists
2. **Subjective** (secondary) — Claude's estimate, labeled honestly

Users learn to weight verification type over raw percentages.

Sources:
- [When Can LLMs Self-Correct? (MIT/TACL 2024)](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00713/125177)
- [Language Models (Mostly) Know What They Know (Anthropic 2022)](https://arxiv.org/abs/2207.05221)
