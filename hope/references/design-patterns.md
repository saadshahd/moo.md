# Skill Design Patterns

Match pattern to task type. Wrong pattern = wrong skill.

## Pattern Selection

| Task Nature | Pattern | Lines | Constraint |
|-------------|---------|-------|------------|
| Creative, taste-based | Mindset | ~50 | Light |
| Multiple scenarios | Navigation | ~30 | Routing only |
| Deep thinking + craft | Philosophy | ~150 | Medium |
| Multi-step workflow | Process | ~200 | Structured |
| Precise operations | Tool | ~300 | Heavy |

## Decision Tree

```
Is output format critical? → Tool
Are there multiple phases? → Process
Is this routing between scenarios? → Navigation
Does this need deep principles + practice? → Philosophy
Otherwise → Mindset
```

---

## 1. Mindset Pattern (~50 lines)

**Use when**: Creative judgment, taste, or philosophy over process.

**Template**:
```markdown
---
name: skill-name
description: [Creative task]. Use when [context]. Triggers on [keywords].
---

# [Skill Name]

## Core Philosophy
- [Principle 1]
- [Principle 2]
- [Principle 3]

## When to Apply
- [Situation 1]
- [Situation 2]

## Key Questions
- [Question to guide decisions]
- [Question to check alignment]

## Anti-Patterns
- [What this is NOT]
```

**Freedom**: High. Provides perspective, not steps.

---

## 2. Navigation Pattern (~30 lines)

**Use when**: Route between multiple scenarios or sub-skills.

**Template**:
```markdown
---
name: skill-name
description: Router for [domain]. Use when [context]. Triggers on [keywords].
---

# [Skill Name]

## Scenario Detection
| Signal | Route To |
|--------|----------|
| [keyword] | [reference] |
| [context] | [workflow] |

## Default
[Fallback when no clear signal]
```

**Freedom**: High for routing, delegates to destinations.

---

## 3. Philosophy Pattern (~150 lines)

**Use when**: Deep thinking AND practical craft together.

**Template**:
```markdown
---
name: skill-name
description: [What + when + keywords].
---

# [Skill Name]

## Philosophy
[Core beliefs - ~40 lines]
- [Belief 1]
- [Belief 2]

## Framework
[Structured approach - ~60 lines]
### [Aspect 1]
### [Aspect 2]

## Application
[Practical use - ~30 lines]
- [How to apply]
- [Examples]

## References
- [Link to deeper material]
```

**Freedom**: Medium. Principles guide, framework structures.

---

## 4. Process Pattern (~200 lines)

**Use when**: Multi-step workflow with clear phases and gates.

**Template**:
```markdown
---
name: skill-name
description: [What + when + keywords].
---

# [Skill Name]

## When to Use
- [Trigger 1]
- [Trigger 2]

## Phases

### Phase 1: [Name]
**Goal**: [What this achieves]
**Steps**:
1. [Step]
2. [Step]
**Gate**: [How to know you're done]

### Phase 2: [Name]
**Goal**: [What this achieves]
**Steps**:
1. [Step]
2. [Step]
**Gate**: [How to know you're done]

## Output Template
[Expected deliverable format]

## Common Mistakes
- [Mistake to avoid]
```

**Freedom**: Low-medium. Follow the phases.

---

## 5. Tool Pattern (~300 lines)

**Use when**: Precise operations, specific inputs/outputs, validation required.

**Template**:
```markdown
---
name: skill-name
description: [What + when + keywords].
---

# [Skill Name]

## Input Requirements
- [Required input 1]
- [Required input 2]
- [Optional inputs]

## Methodology
### Step 1: [Name]
[Detailed instructions]

### Step 2: [Name]
[Detailed instructions]

[Continue ~150 lines of precise steps]

## Output Specification
[Exact format - ~50 lines]
```yaml
field: type
field: type
```

## Validation
- [Check 1]
- [Check 2]

## Edge Cases
| Case | Handling |
|------|----------|
| [Edge case] | [How to handle] |

## References
- [Supporting material]
```

**Freedom**: Low. Precision matters.

---

## Pattern Violations

| Violation | Problem | Fix |
|-----------|---------|-----|
| Tool at 50 lines | Under-specified | Add edge cases, validation |
| Mindset at 300 lines | Over-constrained | Extract to Philosophy or split |
| Process without phases | Not a process | Convert to Philosophy or Tool |
| Navigation that implements | Should delegate | Move logic to references |

## Line Count Checks

Before finalizing a skill:

- **Under minimum?** Missing critical sections
- **Over maximum?** Wrong pattern or needs splitting
- **At maximum without references?** Extract to reference files
