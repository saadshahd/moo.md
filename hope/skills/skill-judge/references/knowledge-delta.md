# Knowledge Delta

Every skill must justify its existence through knowledge delta. Skills without delta are token waste.

## Three Classifications

### [E]xpert Knowledge

Domain expertise Claude genuinely lacks.

**Characteristics:**
- Specialized industry knowledge
- Hard-won operational experience
- Non-obvious failure modes
- Regulatory/compliance specifics
- Security threat models

**Examples:**

| Skill | Why [E]xpert |
| ----- | ------------ |
| PCI-DSS compliance | Specific regulatory requirements Claude wasn't trained on |
| Incident response for healthcare | HIPAA-specific procedures |
| Avionics safety patterns | DO-178C certification requirements |
| Security rationalizations | Common cognitive traps attackers exploit |

**Test:** Would a domain expert say "Claude got this wrong" without the skill?

### [A]ctivation Knowledge

Knowledge Claude has but won't apply without prompting.

**Characteristics:**
- Structured frameworks Claude knows conceptually
- Systematic checklists for consistency
- Mental models that need explicit triggering
- Thought processes that need external structure

**Examples:**

| Skill | Why [A]ctivation |
| ----- | ---------------- |
| Postmortem framework | Claude knows postmortems but won't use structured format |
| Five Whys + prevention | Claude knows technique but stops at surface causes |
| Confidence gates | Claude has knowledge but doesn't self-report reliability |
| Decision matrices | Claude can compare options but won't structure comparison |

**Test:** Does Claude know this but fail to apply it consistently?

### [R]edundant Knowledge

Already in Claude's base capabilities. These skills should not exist.

**Characteristics:**
- Basic programming patterns
- General writing advice
- Common knowledge
- Things Claude does well by default

**Examples:**

| Skill | Why [R]edundant |
| ----- | --------------- |
| "Write clean code" | Claude already writes clean code |
| "Use descriptive names" | Basic coding, no delta |
| "Be concise in emails" | General writing, no delta |
| "Debug step by step" | Claude's natural debugging approach |

**Test:** Does Claude already do this well without prompting?

## Classification Decision Tree

```
Is this specialized domain knowledge Claude wasn't trained on?
├─ Yes → [E]xpert
└─ No → Would Claude apply this consistently without prompting?
         ├─ No → [A]ctivation
         └─ Yes → [R]edundant (delete skill)
```

## Delta Strength Assessment

Within [E] and [A], skills have varying strength.

### High Delta Signals

- Addresses specific failure modes with evidence
- Contains non-obvious trade-offs
- Includes real-world edge cases
- Provides structured decision criteria
- Prevents known rationalizations

### Low Delta Signals

- Mostly general advice
- Could be summarized in one sentence
- No specific examples
- Relies on "use good judgment"
- Repeats common knowledge

## Examples: Good vs Bad

### High Delta Skill (Good)

```markdown
## Security Review Checklist

| Check | Rationalization to Detect |
| ----- | ------------------------- |
| Input validation | "The frontend validates this" |
| Auth boundaries | "This is internal only" |
| Secrets handling | "It's just a dev key" |
| Rate limiting | "We trust our users" |
```

Why high delta: Contains specific rationalizations that are non-obvious and prevent real security failures.

### Low Delta Skill (Bad)

```markdown
## Code Review Guidelines

- Check for bugs
- Ensure code is readable
- Verify tests exist
- Look for security issues
```

Why low delta: Claude already does this. No specific guidance, no non-obvious patterns.

## When to Merge Skills

Low-delta skills should merge into higher-delta skills:

| Instead of | Merge into |
| ---------- | ---------- |
| "Write good tests" | Workflow B debugging (prevention section) |
| "Review code carefully" | Gate skill (verification checklist) |
| "Plan before coding" | Intent skill (clarification protocol) |

## Skill Rejection Criteria

Reject skill if:

1. Classification is [R]edundant
2. [A]ctivation but could be one line in another skill
3. [E]xpert but domain too narrow (< 10 uses/year)
4. Delta doesn't justify token cost

## Token Economics

Every skill has token cost. Must justify:

```
Token Cost = SKILL.md tokens + reference tokens
Value = (frequency of use) × (delta per use)

If Token Cost > Value → reject or merge
```

### Rule of Thumb

- [E]xpert skills: Worth 500+ tokens each
- [A]ctivation skills: Worth 200-500 tokens each
- [R]edundant skills: Worth 0 tokens (delete)
