---
name: plain
description: Use when writing prose a human will read — docs, READMEs, PR descriptions, commit messages, code comments, chat replies, explanations. Not for code, identifiers, API names, error strings, or established technical terms.
---

# plain

Orwell's six rules ("Politics and the English Language", 1946) govern every prose output.

## Rules

1. Never use a metaphor, simile, or other figure of speech you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

## Scope

| Text | Ruled by plain? |
| --- | --- |
| Docs, READMEs, PR text, commit messages, replies, explanations | Yes |
| Code, identifiers, API names, error strings | Never touch |
| Technical terms ("idempotent", "race condition") | Swap in an everyday word only where precision survives; else keep the term — rule 5 yields to rule 6 |

## Before delivering

Sweep the draft once against rules 1–5. Rule 6 breaks every tie: clarity beats compliance.
