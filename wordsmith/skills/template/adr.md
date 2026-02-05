# ADR Template

Architecture Decision Record following MADR 3.0, Nygard, and Y-Statement conventions.

**Adapt structure to context.** These sections are defaults, not requirements. Scale up or down based on decision significance.

## Quality Gates (Check Before Generating)

- [ ] Status is one of: proposed, rejected, accepted, deprecated, superseded
- [ ] At least 2 options considered
- [ ] Each option has both pros AND cons (no free lunch)
- [ ] Consequences include at least one negative
- [ ] Y-statement is complete (all 6 parts)
- [ ] Decision-makers are listed

## Required Context (Gather If Not Evident)

- **Decision** — What are you deciding?
- **Context** — What's the situation?
- **Options** — What alternatives exist? (minimum 2)

If context is clear from conversation, proceed. If ambiguous, ask.

## Template Structure

### Front Matter (MADR 3.0)

```yaml
---
parent: Decisions
nav_order: [number]
title: [Short title capturing problem AND solution]
status: proposed | rejected | accepted | deprecated | superseded by ADR-XXXX
date: YYYY-MM-DD
decision-makers: [list of names/roles]
consulted: [SMEs with two-way communication]
informed: [stakeholders with one-way updates]
---
```

### Required Sections

#### 1. Context and Problem Statement

Describe the situation in 2-3 sentences or narrative format.

**Guidelines:**
- State the current situation
- Identify forces at play
- Note relevant constraints

#### 2. Considered Options

Bulleted list of alternatives. Minimum 2 options.

```markdown
- Option A: [description]
- Option B: [description]
- Option C: [description]
```

#### 3. Decision Outcome

State the chosen option with clear justification.

**Use Y-Statement format:**

> In the context of [use case/situation],
> facing [concern/constraint],
> we decided [option/course of action]
> to achieve [quality/goal],
> accepting [downside/tradeoff],
> because [additional rationale].

### Optional (Recommended) Sections

#### Decision Drivers

Forces influencing the choice:

- [Driver 1]
- [Driver 2]
- [Driver 3]

#### Pros and Cons of Options

For each option, use Good/Bad/Neutral format:

**Option A: [name]**

- Good, because [reason]
- Good, because [reason]
- Bad, because [reason]
- Neutral, because [observation]

**Option B: [name]**

- Good, because [reason]
- Bad, because [reason]
- Bad, because [reason]

#### Consequences

**Positive:**
- [Benefit 1]
- [Benefit 2]

**Negative:**
- [Tradeoff 1]
- [Tradeoff 2]

**Neutral:**
- [Side effect without value judgment]

#### Confirmation

How compliance with this decision will be validated:

- [Validation method 1]
- [Validation method 2]

#### More Information

- Evidence and references
- Team agreements
- Implementation timeline

## Filename Convention

Use present tense imperative with lowercase and dashes:

```
choose-database.md
use-postgresql-over-mongodb.md
adopt-event-sourcing.md
```

## Lifecycle Model

```
Initiating → Researching → Evaluating → Implementing → Maintaining → Sunsetting
```

## Best Practices

| Practice | Why |
|----------|-----|
| One ADR = one decision | Keep focused, easy to reference |
| Timestamp all entries | Costs and schedules decay over time |
| Immutable once accepted | Amend or supersede, never delete |
| Record confidence level | Especially if low confidence |
| Review after 1 month | Compare plan vs reality |
| Minimum 2 options | Forces genuine consideration |

## Output Format

Generate the ADR with all sections populated based on user input. Mark sections needing more detail with `[TODO: ...]`.

After generation, prompt:

> **Draft ready.** Use `/wordsmith:edit` to refine prose, or continue iterating on specific sections.
