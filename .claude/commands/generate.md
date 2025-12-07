---
description: Meta-prompt generator. Creates vanilla command/skill/agent files optimized for Claude Code + Opus 4.5.
---

# /moo:generate

Generate production-ready `.md` files for Claude Code.

## Inputs

- `$1` — Domain (optional, will infer from task if omitted)
- `$2` — Task description (what the generated prompt should do)

## Process

### Phase 1: Parse Intent

Extract from task description:

- **What** — Core function (analyze, generate, debug, search, evaluate, transform)
- **Domain** — Field/area (if provided or inferable)
- **User** — Who invokes this (developer, writer, analyst, anyone)
- **Trigger** — How it's invoked (explicit command, background, delegated)

### Phase 2: Confidence Check

| Confidence | Action                                |
| ---------- | ------------------------------------- |
| < 70%      | Ask ONE clarifying question, then STOP |
| 70-85%     | Generate with `## Assumptions` section |
| ≥ 85%      | Generate directly                     |

**Ask when unclear:**

- "Is this user-invoked or background knowledge?"
- "What's the primary output format?"
- "Who's the target user?"

### Phase 3: Determine Output Type

| Signal                                                    | Type        |
| --------------------------------------------------------- | ----------- |
| "when I run", "command for", explicit invocation          | **Command** |
| "always apply", "principles for", "when working on"       | **Skill**   |
| "search for", "find", "analyze", "evaluate", delegatable  | **Agent**   |

If ambiguous → default to **Command** (most common).

### Phase 4: Generate Using Template

#### Command Template

```markdown
---
description: [What it does and when to use it. Single line. Max 1024 chars.]
---

# /[command-name]

[One-sentence purpose statement.]

## When to Use

[Bullet list of specific situations where this command applies.]

## Inputs

[If command takes arguments, list them with types and descriptions.]

## Process

[Step-by-step execution flow. Use "consider", "evaluate", "reason" instead of "think".]

1. [Step with clear action]
2. [Next step]

## Output Format

[Explicitly specify what the command returns/produces. Examples: file path, JSON structure, markdown report, code snippet.]

## Quality Footer

[For non-trivial commands, include:]

```
Confidence: X-Y% (evidence: [specific])
Alternative: [approach] (confidence: X-Y%, tradeoff: [what changes])
Reversible: Type [2A/2B/1] (rollback: [time/effort])
Complexity: X story points
```

## Examples

[Optional: 1-2 concrete usage examples.]
```

#### Skill Template

```markdown
---
name: [kebab-case-name]
description: [Trigger condition + what it does. Single line. Max 1024 chars. Example: "When refactoring component architecture, apply journey-centric organization and illegal states elimination."]
version: 0.0.1
---

# [Skill Name]

[One-sentence philosophy statement.]

## When This Applies

[Specific trigger conditions. Use "Use when..." not "MUST/CRITICAL/ALWAYS".]

## Core Principles

[Bullet list of fundamental rules. Keep each < 1 line.]

## Process

[If skill involves workflow, provide step-by-step guidance.]

## Anti-Patterns

[What NOT to do. Concrete examples preferred.]

## Quality Gates

[Optional: Confidence thresholds, decision criteria, or validation checks.]

## Examples

[Optional: Before/after snippets showing skill application.]
```

#### Agent Template

```markdown
---
description: [What it searches/analyzes and when to delegate to it. Single line.]
---

# [Agent Name]

[One-sentence role statement.]

## Delegation Trigger

[When Claude should invoke this agent instead of handling directly.]

## Search Strategy

[How the agent approaches its task. Use "consider", "evaluate", "reason".]

1. [Primary search method]
2. [Fallback if primary fails]
3. [Synthesis step]

## Output Format

[Explicitly specify what the agent returns. Examples: file paths list, analysis markdown, JSON summary.]

## Confidence Protocol

Use when unclear:

- [Specific question 1]
- [Specific question 2]

## Examples

[Optional: Sample delegation scenarios.]
```

## Opus 4.5 Optimizations

**Apply these to all generated content:**

1. Replace "think" → "consider/evaluate/reason"
2. Use "Use when..." not "MUST/CRITICAL/ALWAYS"
3. Include explicit output format specifications
4. Add quality footer awareness (Confidence, Alternative, Reversible, Complexity)
5. Reference story points for complexity estimation (never time)
6. Include confidence gates where decisions are made

## Post-Generation

After generating file:

1. State file path where it should be saved
2. Verify frontmatter uses single-line description (no `|` or `>`)
3. Confirm template follows moo.md conventions
4. Provide quality footer:

```
Confidence: X-Y% (evidence: [based on clarity of task description])
Alternative: [Could generate as different type if ambiguous]
Complexity: X story points (generation itself)
```
