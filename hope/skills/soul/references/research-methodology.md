# Research Methodology

Structured approach to research that prevents thin-data conclusions and source quality drift.

## Phase Weighting

Allocate effort deliberately across research phases:

| Phase | Weight | Purpose |
|-------|--------|---------|
| Scoping | 10% | Define what you're actually researching |
| Collection | 40% | Gather sources and data |
| Synthesis | 20% | Organize and connect findings |
| Output | 30% | Produce deliverable |

Don't jump to output without adequate collection. Most failed research skips collection.

## Source Tiers

Explicit quality hierarchy:

| Tier | Description | Examples | Trust Level |
|------|-------------|----------|-------------|
| 1 | Primary/official | Official docs, RFCs, papers, specs | HIGH |
| 2 | Verified secondary | Major publications, reputable blogs, experts | MEDIUM |
| 3 | Community | Stack Overflow, Reddit, forums | VERIFY |
| Avoid | Unreliable | AI-generated content, outdated posts (>2yr) | DON'T USE |

Always cite the tier when referencing a source.

## Confidence Tagging

Every claim needs a confidence level:

| Tag | Meaning | Action |
|-----|---------|--------|
| **[HIGH]** | Multiple Tier 1 sources agree | Quote directly |
| **[MED]** | Single Tier 1 or multiple Tier 2 | Note source |
| **[LOW]** | Tier 3 only, conflicting info | Flag uncertainty |
| **[UNVERIFIED]** | Couldn't find authoritative source | Don't include in output |

Format: `[HIGH] The API rate limit is 1000/hour (official docs, Jan 2024)`

## Quality Gates Before Synthesis

Don't start synthesis until:

- [ ] Scope is bounded (what's IN and OUT)
- [ ] At least 3 Tier 1 or Tier 2 sources collected
- [ ] Major conflicting claims identified
- [ ] Gaps in knowledge documented

If gates fail, return to collection phase. Don't synthesize from thin data.

## Research Scoping Questions

Before diving in:

1. What specific question am I answering?
2. What would a complete answer look like?
3. What's explicitly OUT of scope?
4. What's my time budget?
5. Who is the audience?

See `scope.md` for the full SCOPE framework.

## Collection Protocol

```
1. START BROAD
   Search multiple terms, scan titles
   Don't anchor on first result

2. NARROW
   Identify most relevant sources
   Prioritize Tier 1 over Tier 2

3. DEEP DIVE
   Read primary sources fully
   Don't skim authoritative content

4. CROSS-REFERENCE
   Check claims across sources
   Note where sources agree/disagree

5. NOTE GAPS
   What can't you find?
   What questions remain unanswered?
```

## Synthesis Framework

Organize findings by:

| Category | Question | Output |
|----------|----------|--------|
| **Consensus** | What do all sources agree on? | High-confidence claims |
| **Conflict** | Where do sources disagree? | Areas needing judgment |
| **Gaps** | What's unknown or uncertain? | Future research needs |
| **Implications** | What does this mean for the user? | Actionable insights |

## Research Output Template

```markdown
## Research: [Topic]

### Scope
**Question**: [Specific question being answered]
**Boundaries**: [What's in/out]
**Time spent**: [Actual vs budget]

### Key Findings
- [HIGH] Finding with strong evidence (Source, Date)
- [MED] Finding with moderate evidence (Source)
- [LOW] Finding needing verification

### Source Summary
| Source | Tier | Key Contribution |
|--------|------|------------------|
| [Name] | 1 | [What it provided] |

### Uncertainties
- [Gap or unknown]
- [Conflicting information about X]

### Confidence Assessment
Overall: [HIGH/MEDIUM/LOW]
Rationale: [Why this level based on source quality]
```

## Anti-Patterns

| Pattern | Problem | Prevention |
|---------|---------|------------|
| Accepting first result | Missing better sources | Search 3+ terms minimum |
| No tier tracking | Can't assess reliability | Tag every source |
| Confidence inflation | Overstating certainty | Use confidence tags |
| Scope creep | Research never ends | Time-box collection |
| Synthesis before collection | Conclusions from thin data | Enforce quality gates |
| Single source | False certainty | Require cross-reference |

## Integration with SCOPE

Research methodology maps to the SCOPE framework:

| SCOPE Step | Research Activity |
|------------|-------------------|
| **S**ituate | Understand context and constraints |
| **C**larify | Define the specific question |
| **O**utline | Specify output format |
| **P**rereqs | Identify sources needed |
| **E**dges | Set collection boundaries |

## Quick Reference

```
Before starting:    Run scoping questions
During collection:  Tag every source with tier
Before synthesis:   Check quality gates
In output:          Tag every claim with confidence
After completion:   Note remaining uncertainties
```

---

*Process pattern: Prevents thin-data conclusions through explicit source quality tracking and confidence tagging.*
