#!/usr/bin/env bash
# moo SessionStart hook: Injects full soul SKILL.md at session start.
# UserPromptSubmit (ensure-soul.sh) provides per-turn lightweight reminders as fallback.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

soul_content=$(cat "${PLUGIN_ROOT}/skills/soul/SKILL.md" 2>&1 || echo "Error reading soul skill")

escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

soul_escaped=$(escape_for_json "$soul_content")

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<session-context>\nApply hope:soul. This is the full soul skill content loaded at session start.\n\n${soul_escaped}\n</session-context>"
  }
}
EOF

exit 0
