# Pattern vs Taste

Distinguish delegatable rules from human judgment.

## Definitions

| Type | Description | Delegatable? |
|------|-------------|--------------|
| **Pattern** | Rules you can write down | Yes |
| **Taste** | Contextual judgment, intuition | No |

## Examples

| Pattern (Delegate) | Taste (Keep) |
|-------------------|--------------|
| Code style, formatting | Architecture decisions |
| Error handling templates | Product coherence |
| Naming conventions | Intuitive interface design |
| Test structure | User empathy, edge case prioritization |
| Commit message format | What to build next |
| Documentation templates | Narrative clarity |
| Linting rules | Code "smell" detection |

## Delegation Test

Ask these questions:

1. **Can I write it as a rule?**
   - Yes → Pattern, delegate
   - "It depends" → Taste, keep

2. **Would a checklist work?**
   - Yes → Pattern
   - Requires judgment per item → Taste

3. **Could I explain why to a new hire in 5 minutes?**
   - Yes → Pattern
   - "You'll learn to feel it" → Taste

4. **Is there one right answer?**
   - Yes → Pattern
   - Multiple valid answers → Taste

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Treating pattern as taste | Inconsistency, wasted judgment | Write the rule, automate |
| Treating taste as pattern | Rigid, misses context | Keep human in loop |
| No documentation of patterns | Knowledge trapped in heads | Extract and codify |
| Over-documenting taste | Rules that don't apply | Accept some judgment required |

## Pattern Extraction Protocol

When you notice yourself making the same judgment repeatedly:

1. Write down the rule you're applying
2. Test it against 5 recent examples
3. If it fits all 5 → it's a pattern, codify it
4. If exceptions exist → note the exception conditions
5. If too many exceptions → it's taste, stop trying to codify

## Taste Development

Taste can't be delegated, but it can be developed:

- **Exposure:** See many examples (good and bad)
- **Feedback:** Get reactions to your judgments
- **Reflection:** Articulate why something feels wrong
- **Calibration:** Compare your taste to respected practitioners

## Hybrid Zone

Some things have pattern foundations with taste at the edges:

| Domain | Pattern Layer | Taste Layer |
|--------|---------------|-------------|
| Code review | Style, bugs, security | Readability, maintainability |
| Writing | Grammar, structure | Voice, rhythm |
| Design | Accessibility, consistency | Delight, innovation |

Delegate the pattern layer. Keep the taste layer.
