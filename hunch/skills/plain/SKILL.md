---
name: plain
description: Use when writing prose a human will read — docs, READMEs, PR descriptions, commit messages, code comments, chat replies, explanations. Not for code, identifiers, API names, error strings, or established technical terms.
---

# plain

The reader lacks your context — the curse of knowledge, not word count, is why prose fails. Write as if orienting someone's gaze to a thing they haven't seen yet.

## The spine — Orwell, 1946

1. Never use a metaphor, simile, or other figure of speech you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

## The sweep — named defects Orwell's rules only gesture at

| Defect | Fix | Example |
| --- | --- | --- |
| Zombie noun — an action embalmed as a noun (-tion, -ment, -ance) | Verb it | "perform validation" → "validate" |
| Buried doer — abstract subject, actor missing or in a by-phrase | Doer as subject, action as verb | "the fix was applied" → "I fixed it" |
| Negative form | State it positively | "not different" → "the same" |
| Hedge — "somewhat", "fairly", "arguably", "should probably" | Cut it or commit | "should probably work" → "works" — or name when it fails |
| Abstract where concrete exists | Name the thing | "the relevant file" → "`config.ts`" |
| One sentence, two ideas | Split it | — |

Technical terms: swap in an everyday word only where precision survives; otherwise keep the term — rule 5 yields to rule 6.

## The caps — ASD-STE100

Simplified Technical English adds what Orwell leaves to judgment: hard limits. Caps over taste — "cut what you can" ends in negotiation; a word count ends in a number.

| Cap | Limit |
| --- | --- |
| Sentence | 20 words for an instruction, 25 for anything else |
| Paragraph | 6 sentences, one topic |
| Instruction | one action per sentence |
| Noun cluster | 3 nouns — break longer ones with "of"/"for" |
| Term | one per concept — reuse the exact word, never a synonym |
| Point | made once — no restating in other words, no summary that repeats the body |

The 900-word STE dictionary stays out: the technical-terms rule above already governs word choice.

## Before delivering

One sweep of the draft against the spine, the sweep, and the caps. Rule 6 breaks every tie: clarity beats compliance.
