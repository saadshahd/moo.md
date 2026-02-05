---
name: recall
description: Surface learnings from past sessions. Use when starting work in a domain. Triggers on "recall learnings", "past failures", "what did I learn".
model: haiku
allowed-tools: Read
context: fork
agent: Explore
---

# Recall Learnings

Search ~/.claude/learnings/ for entries matching: $ARGUMENTS

## When to Recall

- **Before starting substantial work** → Recall domain-specific learnings
- **When entering familiar territory** → "What did I learn last time?"
- **Before delegation** → Check delegation.jsonl for past patterns
- **After a failure** → Check if this mistake was already captured

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
   - Recurring failures (same pattern 2+ times)

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

---

## Integration with Loop

When loop:start invokes recall:

1. Extract domain hints from spec (e.g., "auth", "validation", "API")
2. Search all learning categories
3. Surface relevant past failures before decomposition
4. Flag high-confidence constraints that apply

**Automatic invocation:** Loop should call `/hope:recall {domain}` before task decomposition.

---

## Capture Guidance

When you encounter patterns worth capturing, recommend `/hope:learn`:

### What to Capture

| Category | Capture When |
|----------|--------------|
| **Failure** | Same mistake twice, unexpected behavior, debugging took >30 min |
| **Discovery** | Non-obvious solution, library quirk, undocumented behavior |
| **Constraint** | Hard limit discovered, unchangeable requirement |
| **Delegation** | Task delegation succeeded/failed with notable pattern |

### How to Capture

After a session with learnings, prompt:
> "This session had insights worth capturing. Run `/hope:learn` to extract them."

### Example Learnings

**failures.jsonl:**
```json
{"ts": "2026-02-01", "context": "TypeScript generics", "failure": "Recursive type caused infinite loop in compiler", "root_cause": "Missing base case in recursive type", "prevention": "Always add explicit base case: T extends never ? never : ..."}
```

**discoveries.jsonl:**
```json
{"ts": "2026-02-01", "context": "Claude Code hooks", "discovery": "Stop hooks receive JSON via stdin, not environment variables", "confidence": 0.95, "applies_to": "all hooks"}
```

**delegation.jsonl:**
```json
{"ts": "2026-02-01", "context": "multi-file refactor", "spec_score": 6, "fit_score": 32, "shape_chosen": "colleague", "verification_type": "execution output", "outcome": "partial success", "failure_pattern": "scope creep", "root_cause": "spec didn't list explicit boundaries", "prevention": "Add mustNot criteria for refactors"}
```

---

## Boundary

**User controls retention. No silent persistence.**

On first learn capture, disclose:
> "Learnings stored in ~/.claude/learnings/. Default retention: 90 days."
> "Adjust with: `/hope:retention [days|forever|off]`"

- User can delete any learning at any time
- User can disable capture entirely
- Recall surfaces patterns, user decides meaning
