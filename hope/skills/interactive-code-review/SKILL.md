---
name: interactive-code-review
description: Human-in-the-loop, chunk-by-chunk review that mimics a git add -p flow for code and textual artifacts. Use when a user asks to review a PR, diff, draft, patch, document, or work-in-progress and wants an interactive approve/reject/chat loop over reviewable chunks.
---

# Interactive Code Review

## Overview

Run a structured, interactive review session that presents changes or sections in small, readable chunks and waits for the human to approve, reject, or chat before moving on.

## Named Framework

Structured Walkthrough: author intent is surfaced first, then the reviewer probes for risks, gaps, and misunderstandings.

## Evidence It Works

Structured walkthroughs are an established software quality practice used in industry and described in software engineering literature for defect detection and shared understanding.

## Workflow

1. Confirm the review target and intent.
   - Ask for the diff source if unclear (branch range, file paths, or patch).
   - Clarify what “good” looks like (correctness, style, performance, risk).

2. Gather the review material.
   - For code: prefer `git status -sb`, `git diff --stat`, then `git diff <base>...<head>` or `git diff -- <paths>`.
   - For documents or drafts: ask for the text, sections, or the relevant excerpt.

3. Chunk the review.
   - Default to file-by-file, then hunk-by-hunk within each file.
   - Keep chunks small (target 40–120 lines of diff). Split large hunks.
   - For prose or structured text, split by headings, sections, or logical paragraphs.

4. Present each chunk with a standard template and pause for a human decision.
   - Only advance after an explicit response.
   - Accept: approve, reject, chat.

5. Handle responses.
   - Approve: mark as approved and continue.
   - Reject: explain issues, propose concrete edits, and ask for confirmation before changing files.
   - Chat: answer questions or show more context, then ask for approve/reject.

6. Wrap up with a review summary.
   - List approved chunks, rejected chunks, and open questions.
   - Offer to apply edits or re-run review on updated diffs.

## Reviewer Conduct

- Be technically rigorous; verify before asserting or applying edits.
- Ask clarifying questions when feedback or intent is unclear.
- Avoid performative agreement; focus on evidence and fixes.
  - State the issue, impact, and proposed change instead.
  - Do not use gratitude or hype phrases in review output.

## Optional Deep Review Mode

If the user asks for a full review beyond chunk approval (e.g., “production readiness”):
- Collect plan/requirements and the git range or artifact scope.
- Run a structured assessment: plan alignment, code quality, architecture, testing, and readiness.
- Provide a severity-labeled issue list and a merge/ship verdict.

## Interactive Chunk Template

ALWAYS use this format for each chunk:

```
Review chunk [i/N]
File: <path>
Summary: <1–2 lines>

<diff snippet>

Action? (approve / reject / chat)
```

If the user asks for a different action, translate it into approve/reject/chat and confirm.

## Optional Deep Review Output

When running deep review mode, use this format:

### Strengths
[What's well done.]

### Issues

#### Critical (Must Fix)
[Bugs, security, data loss risks]

#### Important (Should Fix)
[Design gaps, missing requirements, test gaps]

#### Minor (Nice to Have)
[Nitpicks, optimizations, docs]

### Recommendations
[Concise improvements]

### Assessment

**Ready to merge?** [Yes/No/With fixes]

**Reasoning:** [1-2 sentences]

## Review Heuristics

- Flag correctness risks, security issues, breaking changes, and missing tests first.
- For text, flag unclear intent, inconsistencies, missing context, and factual gaps.
- Call out surprising behavior or unclear intent.
- If rejecting, include: issue, why it matters, and a concrete fix.
- Keep tone neutral and concise; avoid rewriting unless requested.

## Safety

Do not stage, commit, or modify files unless the user explicitly asks.

## Provenance

Adapted to a Claude Code skill with a git add -p style interaction and a Structured Walkthrough framing.
