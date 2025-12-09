# hope — Power User Reference

Cognitive operating system for structured thinking.

---

| Say this | Get this |
|----------|----------|
| "delve into how X works" | Deep code investigation |
| "plan building X" | Intent clarification + structured plan |
| "recall what I learned about X" | Surface past learnings |
| "/hope:debug 'problem'" | Root cause analysis |
| "/hope:postmortem 'incident'" | Structured incident review |

---

## Skills

Three skills that auto-activate:

| Skill | Purpose | Triggers on |
|-------|---------|-------------|
| `hope:soul` | Foundation for all thinking. Silent audit, confidence gates, workflows. | Every session (mandatory) |
| `hope:gate` | Verification before claiming done. Checklists by workflow type. | "done", "fixed", "complete" |
| `hope:trace` | Root cause analysis. Five Whys, prevention hierarchy. | Bugs, failures, incidents |
| `hope:recall` | Surface relevant learnings from past sessions. | Session start, domain work |

## Agents

| Agent | Purpose | Trigger keywords |
|-------|---------|------------------|
| `hope:delve` | Deep code investigation with tiered output | "how does", "why does", "explain", "trace", "understand" |

## Commands

| Command | Purpose |
|---------|---------|
| `/hope:plan` | Start task with full workflow. Clarify intent, search libraries, assess confidence. |
| `/hope:debug` | Systematic debugging. Effect → Cause → Root → Fix → Prevent. |
| `/hope:postmortem` | Structured post-incident review. Timeline, Five Whys, prevention measures. |
| `/hope:learn` | Extract learnings from session into `~/.claude/learnings/`. |
| `/hope:recall` | Surface relevant learnings from past sessions. |
| `/hope:compact` | Merge duplicate learnings, prune stale entries. |
| `/hope:mirror` | Detect blind spots in a decision. Hidden assumptions, missing perspectives. |
| `/hope:future` | Regret minimization. Project to age 80, evaluate what you'll regret not doing. |
| `/hope:reframe` | Alternative framings for stuck problems. Transform constraints into advantages. |
| `/hope:interrogate` | Generate penetrating questions to deepen understanding. |
| `/hope:calibrate` | Review confidence calibration from prediction history. |

## When to Use

### Plan vs Just Code

| Situation | Approach |
|-----------|----------|
| < 3 story points, clear path | Just code |
| Unfamiliar territory | Plan first |
| Multiple valid approaches | Plan first |
| Will touch > 3 files | Plan first |
| Has failure modes | Plan first |

---

## Core Concepts

### Confidence Gates

No vague words. Percentages only.

| Confidence | Action |
|------------|--------|
| **< 70%** | Research first. Do not recommend yet. |
| **70-85%** | Ship with monitoring and fallback. |
| **≥ 85%** | Ship immediately. |

**Forbidden:** "probably", "likely", "maybe", "might", "could"

### Workflows

| Task | Workflow | Gate |
|------|----------|------|
| Build / Feature | A | Intent clear + Library search |
| Debug / Fix | B | Root cause before workaround |
| Refactor / Architecture | C | Deletion before redesign |

### Quality Footer

Every non-trivial response ends with:

```
Confidence: X-Y% (evidence: [specific])
Alternative: [approach] (X-Y%, tradeoff: [what changes])
Reversible: Type [2A/2B/1] (rollback: [cost])
Key Assumption: [what could invalidate this]
Complexity: X story points
```

### Reversibility

| Type | Rollback | Examples | Action |
|------|----------|----------|--------|
| **2A** | < 1 min | Config, rename | Execute immediately |
| **2B** | < 5 min | Dependency, refactor | Execute with monitoring |
| **1** | Hours+ | Schema, public API | Deep analysis required |

### Learnings System

Three types of learnings stored in `~/.claude/learnings/`:

| File | What it stores |
|------|---------------|
| `failures.jsonl` | Root causes and prevention measures |
| `discoveries.jsonl` | Insights with confidence and applicability |
| `constraints.jsonl` | Boundaries (permanent or temporary) |

See [Learnings System](learnings-system.md) for full documentation.

---

→ Source: [`hope/skills/soul/SKILL.md`](../hope/skills/soul/SKILL.md)
