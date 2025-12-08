# hope

Cognitive operating system for structured thinking.

Applies to: coding, planning, writing, analysis, decision-making—any task requiring clarity.

## Skills

Three skills.

| Skill | Purpose | Auto-triggers on |
|-------|---------|------------------|
| `hope:soul` | Foundation for all thinking. Silent audit, confidence gates, workflows. | Every session (mandatory) |
| `hope:gate` | Verification before claiming done. Checklists by workflow type. | "done", "fixed", "complete" |
| `hope:trace` | Root cause analysis. Five Whys, prevention hierarchy. | Bugs, failures, incidents |

→ Full docs: [`hope/skills/soul/SKILL.md`](../hope/skills/soul/SKILL.md)

## Commands

| Command | Purpose |
|---------|---------|
| `/hope:plan` | Start task with full workflow. Clarify intent, search libraries, assess confidence. |
| `/hope:debug` | Systematic debugging. Effect → Cause → Root → Fix → Prevent. |
| `/hope:postmortem` | Structured post-incident review. Timeline, Five Whys, prevention measures. |
| `/hope:learn` | Extract learnings from session into `~/.claude/learnings/`. |
| `/hope:recall` | Surface relevant learnings from past sessions. |
| `/hope:mirror` | Detect blind spots in a decision. Hidden assumptions, missing perspectives. |
| `/hope:future` | Regret minimization. Project to age 80, evaluate what you'll regret not doing. |
| `/hope:reframe` | Alternative framings for stuck problems. Transform constraints into advantages. |
| `/hope:interrogate` | Generate penetrating questions to deepen understanding. |

→ Full docs: [`hope/commands/`](../hope/commands/)

## Core Concepts

### Confidence Gates

No vague words. Percentages only.

| Confidence | Action |
|------------|--------|
| **< 70%** | Research first. Do not recommend yet. |
| **70-85%** | Ship with monitoring and fallback. |
| **≥ 85%** | Ship immediately. |

Forbidden: "probably", "likely", "maybe", "might", "could"

### Workflows

Three workflows.

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

Three types:

| File | What it stores |
|------|---------------|
| `failures.jsonl` | Root causes and prevention measures |
| `discoveries.jsonl` | Insights with confidence and applicability |
| `constraints.jsonl` | Boundaries (permanent or temporary) |

Location: `~/.claude/learnings/`

`/hope:learn` to extract. `/hope:recall` to surface.

---

→ Source: [`hope/skills/soul/SKILL.md`](../hope/skills/soul/SKILL.md)
