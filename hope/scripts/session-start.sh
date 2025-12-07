#!/bin/bash
# moo.md SessionStart hook: Inject soul skill content

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

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

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<EXTREMELY_IMPORTANT>\n${ESCAPED}\n</EXTREMELY_IMPORTANT>"
  }
}
EOF
