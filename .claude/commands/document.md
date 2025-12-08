---
description: Update plugin documentation with quality workflow. Voice extraction, edit, polish, eval passes.
---

# Documentation Workflow

Update or create documentation for moo.md plugins.

## Principles

1. **Reference over duplication** — Link to source skills/commands, don't copy
2. **Lean docs** — Each file under 100 lines, total under 300
3. **One purpose per doc** — Navigation OR onboarding OR reference
4. **Quality gates** — Every doc must score ACCEPT on eval

## 4-Pass Workflow

### Pass 1: Draft

For new docs:
1. Use `/wordsmith:voice` on README.md to extract voice profile
2. Use `/wordsmith:narrative` for onboarding docs (3-act structure)
3. Write reference docs as tables linking to source files

Voice traits: Direct, short sentences, fragments for rhythm, no hedging, imperatives.

### Pass 2: Edit

Run `/wordsmith:edit` on each section:
- Cut redundancy
- Tighten prose
- Replace jargon with plain language

### Pass 3: Polish

Apply `elements-of-style:writing-clearly-and-concisely`:
- Active voice
- Positive form
- Omit needless words
- Emphatic words at end

### Pass 4: Publish

Run `/wordsmith:blog-eval` on each doc:
- Must score **ACCEPT** (≥4.2)
- If REVISE: fix gaps and re-evaluate
- Commit only after all docs pass

## Audit Checklist

Before committing, verify:

```
□ No philosophy duplication (only in README.md)
□ index.md is navigation only (no content)
□ Each doc has ONE clear purpose
□ All source links valid (../hope/skills/...)
□ Silent audit matches actual skill
□ Total lines under 300
□ Each doc under 100 lines
```

## Big-Picture Audit

After editing, step back:
1. Read all docs in sequence
2. Check for repetition across files
3. Verify navigation flow makes sense
4. Confirm no content drift from source

$ARGUMENTS
