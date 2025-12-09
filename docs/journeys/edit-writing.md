# Edit Writing

Your prose needs tightening. You want fewer words with the same meaning.

## The Keyword

```
/wordsmith:edit "paste your text here"
```

Or just paste text with a request:

```
edit this: "Your draft text goes here..."
```

The wordsmith skill auto-activates on phrases like:
- "edit this"
- "improve this"
- "review my writing"
- "fix my prose"

## What Happens

The system applies precision editing:

1. **Cut unnecessary words** — Filler, redundancy, weak qualifiers
2. **Preserve your voice** — Doesn't impose a different style
3. **Tighten argument** — Strengthen logical flow
4. **No content additions** — Only removes or restructures

## Common Cuts

| Pattern | Before | After |
|---------|--------|-------|
| Weak qualifiers | "very unique" | "unique" |
| Redundancy | "past history" | "history" |
| Filler phrases | "in order to" | "to" |
| Passive voice | "was done by" | "[actor] did" |
| Hedge words | "I think that maybe" | Direct statement |
| Nominalizations | "make a decision" | "decide" |

## Example Session

```
You: edit this: "In order to be able to successfully complete
the project, we will need to make sure that all team members
are fully aware of what the requirements actually are."

System: ### Marked-Up Version

~~In order to be able to~~ **To** ~~successfully~~ complete the
project, ~~we will need to make sure that~~ all team members
~~are fully aware of what the requirements actually are~~
**must know the requirements**.

### Clean Final Version

To complete the project, all team members must know the requirements.

### Edit Summary
- Original: 31 words
- Final: 11 words
- Reduction: 65%

### Key Changes
1. Filler removal: "in order to be able to" → "to"
2. Redundancy cut: "successfully complete" → "complete"
3. Tightening: "make sure that...are fully aware" → "must know"
```

## Voice Extraction

Need to match someone's writing style? Extract their voice profile first:

```
/wordsmith:voice "paste 300-500 words of their writing"
```

The system analyzes:
- **Tone** — Formal vs casual, serious vs playful
- **Cadence** — Sentence length, paragraph rhythm
- **Vocabulary** — Jargon level, favorite phrases
- **Syntax** — Active/passive preference, question usage
- **Rhetorical moves** — How they open, transition, close

Output is a reusable voice profile you can apply to future writing.

## Related Commands

| Command | Purpose |
|---------|---------|
| `/wordsmith:voice` | Extract voice profile from sample |
| `/wordsmith:narrative` | Build 3-act story structure |
| `/wordsmith:copy` | Rewrite UI text in 3 brand tones |
| `/wordsmith:blog-eval` | Score content quality (ACCEPT/REVISE/REJECT) |

## When to Use Each

| Situation | Command |
|-----------|---------|
| Tighten existing prose | **/wordsmith:edit** |
| Match someone's style | `/wordsmith:voice` first |
| Structure a story/talk | `/wordsmith:narrative` |
| Write button/UI text | `/wordsmith:copy` |
| Check if content is ready | `/wordsmith:blog-eval` |

---

| Say this | Get this |
|----------|----------|
| "edit this: [text]" | Marked-up edit + clean version |
| "/wordsmith:voice [sample]" | Reusable voice profile |
| "make it tighter" | More aggressive cuts |

**Next:** [Learnings System](../learnings-system.md) — how your thinking compounds
