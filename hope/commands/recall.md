---
description: Recall relevant learnings for current context. Use when starting work in a domain to surface past insights.
---

# /recall

Surface relevant learnings from past sessions.

## Input

$ARGUMENTS

Optional context hint (e.g., "hooks", "testing", "typescript"). If empty, infer from current project/conversation.

## Process

1. **Read learnings files**:
   ```bash
   cat ~/.claude/learnings/failures.jsonl 2>/dev/null
   cat ~/.claude/learnings/discoveries.jsonl 2>/dev/null
   cat ~/.claude/learnings/constraints.jsonl 2>/dev/null
   ```

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
