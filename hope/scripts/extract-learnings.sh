#!/bin/bash
# moo.md SessionEnd hook: Trigger learnings extraction

# Skip if this is a hook-spawned extraction session (prevents infinite loop)
[ "$HOPE_EXTRACTING" = "1" ] && echo '{"decision":"approve","reason":"Skipped - extraction session"}' && exit 0

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')
REASON=$(echo "$INPUT" | jq -r '.reason')

# Gate 1: Skip if transcript doesn't exist
[ ! -f "$TRANSCRIPT_PATH" ] && echo '{"decision":"approve","reason":"No transcript file"}' && exit 0

# Gate 2: Count user messages (need real conversation)
USER_MSGS=$(jq -s '[.[] | select(.type == "user")] | length' "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)
if [ "$USER_MSGS" -lt 3 ]; then
    echo '{"decision":"approve","reason":"Short session ('"$USER_MSGS"' msgs) - skipping extraction"}'
    exit 0
fi

# Gate 3: Check line count (need substantial work)
LINE_COUNT=$(wc -l < "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)
if [ "$LINE_COUNT" -lt 100 ]; then
    echo '{"decision":"approve","reason":"Small session ('"$LINE_COUNT"' lines) - skipping extraction"}'
    exit 0
fi

# Extract learnings in background - LLM handles large file chunking
HOPE_EXTRACTING=1 claude -p "/hope:learn $TRANSCRIPT_PATH" \
  --allowedTools "Read,Bash,Write" \
  --permission-mode acceptEdits \
  >/dev/null 2>&1 &

# Log session (only sessions that passed gating)
mkdir -p ~/.claude/learnings
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"session_id\":\"$SESSION_ID\",\"transcript_path\":\"$TRANSCRIPT_PATH\",\"reason\":\"$REASON\",\"user_msgs\":$USER_MSGS,\"lines\":$LINE_COUNT}" >> ~/.claude/learnings/sessions.jsonl

echo '{"decision":"approve","reason":"Learnings extraction started"}'
