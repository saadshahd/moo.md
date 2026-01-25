# Skill Design Patterns

Five patterns for different task natures. Match pattern to purpose.

## Pattern Overview

| Pattern | Lines | Freedom | Constraints | Best For |
| ------- | ----- | ------- | ----------- | -------- |
| Mindset | ~50 | High | Light | Creative/taste tasks |
| Navigation | ~30 | Varies | Routing | Multi-scenario branching |
| Philosophy | ~150 | Medium | Principles | Deep thinking + craft |
| Process | ~200 | Low | Steps | Multi-step workflows |
| Tool | ~300 | Very Low | Precise | Specific operations |

## 1. Mindset Pattern (~50 lines)

For creative tasks requiring taste and judgment.

### Characteristics

- Sets perspective, not procedures
- Trusts Claude's judgment after framing
- Minimal output constraints
- Focus on "how to think" not "what to do"

### Structure

```markdown
# [skill-name]

[One paragraph: the mindset to adopt]

## Principles
- [Principle 1]
- [Principle 2]
- [Principle 3]

## Avoid
- [Anti-mindset 1]
- [Anti-mindset 2]
```

### Examples

- Voice extraction for writing
- Creative brainstorming
- Aesthetic judgments
- Narrative decisions

### When to Use

- Output quality is subjective
- User wants Claude's creative input
- Over-constraining would hurt results
- "Feel" matters more than format

## 2. Navigation Pattern (~30 lines)

For routing between different scenarios.

### Characteristics

- Decision tree at the top
- Routes to other skills or sections
- Minimal content itself
- Clear trigger conditions

### Structure

```markdown
# [skill-name]

## Route

| Trigger | Action |
| ------- | ------ |
| [Condition 1] | Use [skill-a] |
| [Condition 2] | Use [skill-b] |
| [Condition 3] | See section below |

## [Fallback Section]
[Brief guidance if no route matches]
```

### Examples

- Product workflows router (PRD vs analysis vs metrics)
- Career workflows router (interview vs assessment)
- Debug entry point (trace vs gate vs quick fix)

### When to Use

- One skill name, many scenarios
- Need clear routing logic
- Child skills handle details
- Plugin entry points

## 3. Philosophy Pattern (~150 lines)

For tasks requiring deep thinking and craft.

### Characteristics

- Principles over procedures
- Explains "why" behind guidance
- Examples showing good vs bad
- Room for judgment within framework

### Structure

```markdown
# [skill-name]

[Philosophy statement]

## Core Principles

### [Principle 1]
[Explanation with why]

### [Principle 2]
[Explanation with why]

## Application

| Situation | Apply |
| --------- | ----- |
| [Case 1] | [Guidance] |
| [Case 2] | [Guidance] |

## Examples

### Good
[Example with annotation]

### Bad
[Counter-example with annotation]

## Anti-Patterns
[Table of what to avoid]
```

### Examples

- Blameless postmortem philosophy
- Code architecture principles
- Writing craft guidelines
- Design system thinking

### When to Use

- Understanding matters as much as output
- Principles need internalization
- Context varies significantly
- Quality requires judgment

## 4. Process Pattern (~200 lines)

For multi-step workflows with defined sequence.

### Characteristics

- Numbered steps
- Clear entry/exit criteria
- Checkpoints between phases
- Defined output per step

### Structure

```markdown
# [skill-name]

## When to Use
[Trigger conditions]

## Process

### 1. [Step Name]
[Instructions]
Output: [Expected result]

### 2. [Step Name]
Gate: [Condition to proceed]
[Instructions]
Output: [Expected result]

### 3. [Step Name]
[Instructions]
Output: [Expected result]

## Output Format
[Final deliverable template]

## Anti-Patterns
[Common process failures]
```

### Examples

- Trace skill (5 whys + prevention)
- Intent clarification protocol
- Skill evaluation process
- Incident response workflow

### When to Use

- Steps have dependencies
- Gates prevent premature progress
- Output structure matters
- Consistency across uses needed

## 5. Tool Pattern (~300 lines)

For precise operations with specific outputs.

### Characteristics

- Detailed templates
- Explicit constraints
- Little judgment required
- Reproducible outputs

### Structure

```markdown
# [skill-name]

## Purpose
[One line]

## Input Requirements
[What must be provided]

## Process

### Step 1: [Name]
Input: [Required]
Action: [Precise instruction]
Output: [Exact format]

### Step 2: [Name]
[Same structure]

## Output Template
```
[Exact template with placeholders]
```

## Validation
[How to verify correctness]

## Error Handling
| Error | Resolution |
| ----- | ---------- |
| [Error 1] | [Fix] |
| [Error 2] | [Fix] |

## Anti-Patterns
[Detailed failure modes]
```

### Examples

- Quality footer generation
- PR description formatting
- Changelog entry creation
- Eval case generation

### When to Use

- Output must be precise
- Deviation is failure
- Template-driven output
- Verification is objective

## Pattern Selection Guide

```
Is the output subjective/creative?
├─ Yes → Is there a framework to apply?
│        ├─ Yes → Philosophy
│        └─ No → Mindset
└─ No → Is this routing to other skills?
         ├─ Yes → Navigation
         └─ No → Are there dependent steps?
                  ├─ Yes → Process
                  └─ No → Tool
```

## Common Mismatches

| Symptom | Likely Mismatch | Fix |
| ------- | --------------- | --- |
| Skill feels constraining for creative task | Tool used for Mindset task | Reduce constraints |
| Inconsistent outputs across uses | Mindset used for Tool task | Add templates |
| Users skip steps | Process used for simple task | Simplify to Tool |
| Skill too long for routing | Process used for Navigation | Extract to child skills |
| Deep principles lost in steps | Process used for Philosophy | Restructure around principles |

## Line Count Guidance

These are guidelines, not rules:

| Pattern | Target | Acceptable Range |
| ------- | ------ | ---------------- |
| Mindset | 50 | 30-80 |
| Navigation | 30 | 20-50 |
| Philosophy | 150 | 100-200 |
| Process | 200 | 150-300 |
| Tool | 300 | 200-400 |

Over range: Consider splitting or using references.
Under range: Ensure sufficient guidance for pattern type.
