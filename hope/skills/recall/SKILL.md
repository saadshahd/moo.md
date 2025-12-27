---
name: recall
description: Auto-activates at session start to surface relevant learnings. Use when starting work in a domain to recall past insights from ~/.claude/learnings/.
---

# Recall Skill

Surface relevant learnings from past sessions.

## When This Skill Activates

- Session start (new or resumed)
- Before substantial work in a domain
- When soul skill's Silent Audit prompts "Learnings recalled?"
- Explicitly via `/hope:recall [context]`

## Input

Optional context hint (e.g., "hooks", "testing", "typescript"). If empty, infer from current project/conversation.

## Process

1. **Read learnings files** using the Read tool:

   - `~/.claude/learnings/failures.jsonl`
   - `~/.claude/learnings/discoveries.jsonl`
   - `~/.claude/learnings/constraints.jsonl`

   If files don't exist, skip silently.

2. **Filter by relevance**:

   - Match `context` field against provided hint or inferred domain
   - Match `applies_to` tags against current work
   - Prioritize recent entries (last 30 days)
   - Prioritize high-confidence discoveries (>= 0.8)

3. **Output format**:

### Relevant Failures

- **[context]**: [failure] → Prevention: [prevention]

### Relevant Discoveries

- **[context]** (confidence: X): [discovery]

### Active Constraints

- **[context]**: [constraint] (permanent: yes/no)

4. **If no relevant learnings**: Report "No learnings found for [context]"
