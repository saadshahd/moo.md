#!/bin/bash
# moo.md pre-compact: extract learnings before context loss

mkdir -p ~/.claude/learnings

cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "additionalContext": "<MOO_MD_PRE_COMPACT>\nBefore compaction, extract learnings:\n\n1. Failures → ~/.claude/learnings/failures.jsonl\n   {ts, context, failure, root_cause, prevention}\n\n2. Discoveries → ~/.claude/learnings/discoveries.jsonl\n   {ts, context, discovery, confidence, applies_to}\n\n3. Constraints → ~/.claude/learnings/constraints.jsonl\n   {ts, context, constraint, source, permanent}\n\n4. Predictions → update outcomes in predictions.jsonl\n\n5. Contradictions → Ask if new learnings conflict with existing\n\nComplete extraction before proceeding.\n</MOO_MD_PRE_COMPACT>"
  }
}
EOF
