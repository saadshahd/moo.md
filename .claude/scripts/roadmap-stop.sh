#!/bin/bash
INPUT=$(cat)
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // "false"')

if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

jq -n '{
  decision: "block",
  reason: "Before ending, two checks:\n1. ROADMAP.md — update for ideas explored, decisions made, or items completed this session (max 100 lines, 120 chars/line). Skip if no updates needed.\n2. Auto-memory — record structured entries in MEMORY.md or topic files under .claude/projects/*/memory/. Organize by: ## Decisions (rationale + date), ## Patterns (confirmed or refuted), ## Eliminations (approaches rejected + why), ## Metrics (satisfaction scores from non-trivial work). Skip sections with nothing new. Keep MEMORY.md under 200 lines total."
}'
