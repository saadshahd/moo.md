---
name: recall
description: Surface relevant learnings from past sessions. Use when starting work in a domain to avoid repeating mistakes. Triggers on "recall learnings", "past failures", "surface insights", "what did I learn".
model: haiku
allowed-tools: Read
context: fork
agent: Explore
---

# Recall Learnings

Search ~/.claude/learnings/ for entries matching: $ARGUMENTS

## Task

1. Read these files (skip silently if missing):
   - `~/.claude/learnings/failures.jsonl`
   - `~/.claude/learnings/discoveries.jsonl`
   - `~/.claude/learnings/constraints.jsonl`
   - `~/.claude/learnings/delegation.jsonl`

2. Filter entries where `context` or `applies_to` matches the provided hint (or infer from $ARGUMENTS if empty)

3. Prioritize:
   - Recent entries (last 30 days)
   - High-confidence discoveries (>= 0.8)

4. Return top 5 most relevant learnings in this format:

### Relevant Failures
- **[context]**: [failure] → Prevention: [prevention]

### Relevant Discoveries
- **[context]** (confidence: X): [discovery]

### Active Constraints
- **[context]**: [constraint] (permanent: yes/no)

### Delegation Learnings
- **[shape_chosen] → [outcome]**: [prevention]

5. If no matches found: "No learnings found for [hint]"
