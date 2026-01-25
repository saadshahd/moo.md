# Precision Editing

Cut the fluff, keep the voice. Edit prose for clarity without losing the author's style.

## Input Required

Ask for:

- Passage to edit
- Any constraints (word count target, tone to preserve)

## Editing Principles

1. **Cut unnecessary words** - Remove filler, redundancy, weak qualifiers
2. **Preserve author voice** - Don't impose your style
3. **Tighten argument** - Strengthen logical flow
4. **No content additions** - Only remove or restructure unless asked

## Common Cuts

### Weak Qualifiers

| Pattern | Example | Fix |
|---------|---------|-----|
| Unnecessary "very" | "very essential" | "essential" |
| "Quite" hedging | "quite important" | "important" |
| "Rather" weakening | "rather difficult" | "difficult" |
| "Somewhat" hedging | "somewhat problematic" | "problematic" |
| "Fairly" softening | "fairly common" | "common" |
| "Really" padding | "really good" | "excellent" or be specific |
| False modesty | "I think that perhaps" | state position directly |
| "Tends to" softening | "tends to fail" | "often fails" or "fails when..." |

### Redundancy

| Pattern | Example | Fix |
|---------|---------|-----|
| Redundant pairs | "each and every" | "each" or "every" |
| Past history | "past history" | "history" |
| Future plans | "future plans" | "plans" |
| Free gift | "free gift" | "gift" |
| End result | "end result" | "result" |
| Basic fundamentals | "basic fundamentals" | "fundamentals" |
| Completely unanimous | "completely unanimous" | "unanimous" |
| True fact | "true fact" | "fact" |
| Advance planning | "advance planning" | "planning" |

### Filler Phrases

| Pattern | Example | Fix |
|---------|---------|-----|
| "In order to" | "in order to complete" | "to complete" |
| "Due to the fact that" | "due to the fact that it failed" | "because it failed" |
| "At this point in time" | "at this point in time" | "now" |
| "In the event that" | "in the event that it fails" | "if it fails" |
| "For the purpose of" | "for the purpose of testing" | "to test" |
| "In spite of the fact" | "in spite of the fact that" | "although" |
| "With regard to" | "with regard to performance" | "about performance" |
| "In terms of" | "in terms of scalability" | rephrase directly |
| "As a matter of fact" | "as a matter of fact" | delete or "actually" |

### Weak Verbs

| Pattern | Example | Fix |
|---------|---------|-----|
| "There is/are" opener | "There are many ways" | "Many ways exist" or restructure |
| Weak "is" | "The issue is that X" | "The issue: X" or restructure |
| "Has" as filler | "This has the ability to" | "This can" |
| "Appear to" | "appears to be broken" | "is broken" (if certain) |
| "Seem to" | "seems to indicate" | "indicates" (if certain) |
| "Make" + noun | "make a decision" | "decide" |
| "Give" + noun | "give consideration" | "consider" |
| "Take" + noun | "take action" | "act" |

### Passive Voice (When Weak)

| Pattern | Example | Fix |
|---------|---------|-----|
| Hidden actor | "was done by the team" | "the team did" |
| Vague passive | "mistakes were made" | "[who] made mistakes" |
| Buried action | "a decision was made to" | "[who] decided to" |
| "It was determined" | "it was determined that" | "[who] determined" |

### False Transitions

| Pattern | Example | Fix |
|---------|---------|-----|
| Unnecessary "however" | "However, it works." (no contrast) | delete |
| Empty "therefore" | "Therefore, we continue." (no logic) | delete or explain |
| "Moreover" padding | "Moreover, X." (not adding) | delete |
| "Furthermore" filler | "Furthermore" (not extending) | delete |
| "Additionally" noise | "Additionally" (already adding) | delete |

### Empty Descriptors

| Pattern | Example | Fix |
|---------|---------|-----|
| "Interesting" | "an interesting approach" | explain what makes it interesting |
| "Important" | "this is important" | explain why |
| "Unique" | "a unique solution" | describe what makes it unique |
| "Significant" | "significant improvements" | quantify |
| "Various" | "various reasons" | list the reasons |
| "Certain" | "certain issues" | name the issues |

### Over-Explanation

| Pattern | Example | Fix |
|---------|---------|-----|
| Stating obvious | "As you can see from the code above" | delete |
| Over-attribution | "According to what we discussed" | state directly |
| "Basically" padding | "Basically, it works by" | "It works by" |
| "Essentially" filler | "Essentially, the point is" | "The point is" |
| "Literally" misuse | "literally the best" | delete unless actual |
| "Obviously" | "Obviously, this matters" | delete or reconsider |
| "Clearly" | "Clearly, we should" | delete or prove it |

## Output Format

Provide three sections:

### 1. Marked-Up Version

Show changes inline:

- ~~Strikethrough~~ for deletions
- **Bold** for additions or restructured text
- [Note: explanation] for non-obvious changes

### 2. Clean Final Version

The edited text without markup.

### 3. Edit Summary

```
## Edit Summary

- Original word count: [X]
- Final word count: [X]
- Reduction: [X]%

### Key Changes
1. [Change category]: [Brief explanation]
2. [Change category]: [Brief explanation]
3. [Change category]: [Brief explanation]
```

## Attention Budget

Editing has diminishing returns. Track optimization level to know when to stop.

### Optimization Assessment

After each editing pass, estimate:

```
Document is [X]% optimized. Further editing returns ~[Y]% improvement.
```

| Pass | Typical Improvement | Focus |
|------|---------------------|-------|
| 1 | 30-50% | Structure, major cuts, flow |
| 2 | 15-25% | Tightening, transitions, clarity |
| 3 | 5-10% | Polish, rhythm, word choice |
| 4+ | <5% | Diminishing returns territory |

### Stop Gate

When improvement estimate drops below 5%, issue:

```
⏹️ Stop editing. Ship. Measure real feedback.

This document is ~[X]% optimized. Further passes yield <5% improvement.
Reader feedback will be more valuable than additional editing.
```

### Revision Cycle Limits

| Document Type | Max Passes | Rationale |
|---------------|------------|-----------|
| Internal docs | 2 | Speed > polish |
| External copy | 3 | Reputation matters, but diminishing returns |
| High-stakes (legal, PR) | 4 | Precision critical, but still has limits |

### When to Override

- Substantive feedback received (restarts cycle)
- New requirements emerged
- Target audience changed

**Not valid overrides:** Perfectionism, anxiety, "one more look"

---

## Rules

- Show ALL changes in markup, not just major ones
- Explain non-obvious edits
- Preserve author's distinctive phrases and rhythms
- If voice is unclear, ask for more context
- Use Ask tool if passage is ambiguous
