# RFC Template

Request for Comments document following Google, Uber, and HashiCorp conventions.

**Adapt structure to context.** These sections are defaults, not requirements. Omit or combine sections based on RFC scope and audience.

## Quality Gates (Check Before Generating)

- [ ] Non-goals are exclusions, not negations
- [ ] Alternatives section explains why chosen > others
- [ ] At least 2 open questions identified
- [ ] Trade-offs are explicit, not buried
- [ ] Status is one of: Draft, Under-review, Approved, In-progress, Completed

## Required Context (Gather If Not Evident)

- **Topic/title** — What is this RFC about?
- **Problem** — What problem does this solve?
- **Audience** — Who needs to review/approve?

If context is clear from conversation, proceed. If ambiguous, ask.

## When to Write an RFC

Write one if 3+ are true (Google heuristic):

- Uncertain about the right design approach?
- Would senior engineer input help?
- Is the design ambiguous or contentious?
- Does the team neglect privacy/security/logging?
- Need high-level documentation for a legacy system?

## Template Structure

### Header Block

```
RFC: [number or TBD]
Title: [title]
Author: [name]
Status: Draft | Under-review | Approved | In-progress | Completed
Created: [date]
Approvers: [names/roles, if applicable]
```

### Required Sections

#### 1. Context & Scope

Technical landscape and what's being built.

**Guidelines:**
- Succinct, assume prior knowledge
- Don't over-explain basics
- 2-3 paragraphs max

#### 2. Goals & Non-Goals

**Goals:** What we're trying to achieve.

**Non-Goals:** Deliberate exclusions from scope.

**Key rule:** Non-goals are NOT negated goals ("won't crash" is bad). They're deliberate exclusions ("ACID compliance is out of scope because...").

#### 3. The Actual Design

The core of the RFC. Emphasis on trade-offs.

**Include:**
- System-context diagram (how it fits with existing systems)
- APIs (sketch, don't copy-paste complete schemas)
- Data storage approach
- Code/pseudo-code only for novel algorithms

**Guidelines:**
- Lead with trade-offs, not implementation details
- Explain WHY this design over alternatives
- Link to prototypes instead of pasting code

#### 4. Alternatives Considered

Critical section. Explains why chosen approach > others.

For each alternative:
- What was considered
- Pros and cons
- Why rejected

#### 5. Open Questions

Unresolved decisions and areas needing input.

- List genuine unknowns
- Tag owners if applicable
- Include timeline for resolution

### Optional Sections

#### Cross-Cutting Concerns

Address org-specific standards:
- Security considerations
- Privacy implications
- Observability/monitoring
- Performance requirements

#### Abandoned Ideas

What was tried and discarded:
- Approach
- Why abandoned (brief)

## Mini RFC Variant

For smaller changes (< 5 story points), use abbreviated format:

```
RFC: [number]
Title: [title]
Author: [name]
Status: [status]

## Problem
[1-2 sentences]

## Solution
[1-2 sentences]

## Open Questions
[Bulleted list]
```

## Lifecycle Phases

1. **Creation & rapid iteration** — Author + close collaborators
2. **Review** — Broader audience, formal for senior eng input
3. **Implementation & iteration** — Update as reality surfaces gaps
4. **Maintenance & learning** — Entry point for future engineers

## Length Guidance

| Type | Length | When |
|------|--------|------|
| Mini RFC | 1-3 pages | Incremental improvements |
| Full RFC | 10-20 pages | Larger projects |

## Anti-Patterns

Avoid these:

| Anti-Pattern | Problem |
|--------------|---------|
| Implementation manual | Says "how" without discussing trade-offs |
| Over-formalization | Copies complete schemas that quickly become stale |
| Insufficient review | Skips consensus on contentious decisions |
| Neglected updates | Design drifts from reality |

## Output Format

Generate the RFC with all sections populated based on user input. Mark sections needing more detail with `[TODO: ...]`.

After generation, prompt:

> **Draft ready.** Use `/wordsmith:edit` to refine prose, or continue iterating on specific sections.
