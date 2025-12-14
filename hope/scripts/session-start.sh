#!/bin/bash
# moo.md SessionStart hook: Inject soul skill content + today's date

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Dynamic date for Claude's context
TODAY=$(date "+%d %B %Y")
DATE_CONTEXT="Today's date is ${TODAY}."

escape_for_json() {
    local content="$1"
    content="${content//\\/\\\\}"
    content="${content//\"/\\\"}"
    content="${content//$'\n'/\\n}"
    content="${content//$'\t'/\\t}"
    content="${content//$'\r'/}"
    echo -n "$content"
}

SKILL_CONTENT=$(cat "${PLUGIN_ROOT}/skills/soul/SKILL.md")
ESCAPED=$(escape_for_json "$SKILL_CONTENT")

# Add recall reminder - LLM will do semantic filtering
RECALL_REMINDER="\\n\\nIMPORTANT: Run hope:recall skill to surface relevant past learnings from ~/.claude/learnings/ before starting work."

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<EXTREMELY_IMPORTANT>\n${DATE_CONTEXT}\n\n${ESCAPED}\n</EXTREMELY_IMPORTANT>${RECALL_REMINDER}"
  }
}
EOF
