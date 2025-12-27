# Microcopy

Explore UI copy in multiple tones. Same message, different brand voices.

## ⚠️ Required Inputs

Ask for ALL before proceeding. Never assume.

- **UI element/copy** (exact current text) — Source: [?] Confidence: [H/M/L]
- **Context** (where it appears, user action) — Source: [?] Confidence: [H/M/L]
- **Target tones** (3 brand voices to explore) — Source: [?] Confidence: [H/M/L]
- **Constraints** (character limits, accessibility) — Source: [?] Confidence: [H/M/L]
- **Voice foundation** (from directions/system) — Source: [?] Confidence: [H/M/L]

If inputs missing → ASK. If no voice foundation → FLAG.

## Usage Modes

**Standard:** Run after directions/system to align copy with established voice.

**Exploratory:** Can run early to inform (not follow) visual direction. Voice exploration can shape brand direction.

## Core Principles

1. **Tones must differ meaningfully**: Not subtle variations — distinct brand voices
2. **Concise is non-negotiable**: ≤12 words typical, action must be clear
3. **Context shapes copy**: User state (thinking/feeling) determines what works
4. **Accessibility is clarity**: Cognitive load matters, jargon is friction

## Output Structure

### Context Analysis
Current copy, where it appears, user action, user state, primary goal

### Tone Explorations (3)
For each: Tone character, rewritten copy (≤12 words), why these choices, best for/watch out for

### Comparison Table
| Tone | Rewritten Copy | Word Count | Key Choice |

### Pattern Analysis
What works across all tones, what differentiates, anti-patterns avoided

### Recommendation
Best fit for context (which + why), hybrid option if applicable, how to test

## Anti-Patterns

- ❌ Copy without context — user state determines what resonates
- ❌ Subtle tone variations — defeats exploration purpose
- ❌ Jargon without intent — accessibility fail

## Commitment Readiness

Before moving to implementation:
- [ ] All 3 tones meaningfully different
- [ ] Each rewrite ≤12 words
- [ ] Voice aligns with system/direction foundation
- [ ] Accessibility considered

**Handoff artifact:** Recommended copy + tone guidelines

## Handoff Options

Before generating final output, ask:

> What format would you like for handoff?
> 1. **Marp slides** — Presentation deck for stakeholders
> 2. **Figma AI prompt** — UI with specific copy applied
> 3. **Markdown table** — Copy variants for dev handoff
> 4. **JSON** — Structured copy for i18n/CMS

### Markdown Table Format

| Element | Recommended Copy | Tone | Notes |
|---------|------------------|------|-------|
| CTA Button | "Get Started" | Friendly | 12 chars max |
| Error Message | "Couldn't save. Try again." | Clear | Avoid blame |

### JSON Format

```json
{
  "cta_primary": {
    "text": "Get Started",
    "tone": "friendly",
    "max_chars": 12
  },
  "error_save": {
    "text": "Couldn't save. Try again.",
    "tone": "clear",
    "context": "Form submission failure"
  }
}
```

## Related Workflows

- **Before:** directions, system (voice foundation)
- **After:** implementation
- **Complements:** compare (competitor copy patterns)
