#!/bin/bash
INPUT=$(cat)
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // "false"')

if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

jq -n '{
  decision: "block",
  reason: "Before ending: ROADMAP.md — update for ideas explored, decisions made, or items completed this session (max 100 lines, 120 chars/line). Skip if no updates needed."
}'
