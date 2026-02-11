#!/usr/bin/env bash
# moo SubagentStart hook: Injects compact soul primer + pipeline state into subagents.

set -euo pipefail

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')

PRIMER='Subagent principles:
- Observable > inspected > assumed. Never ship on assumption alone.
- mustNot[] violations are hard stops — surface immediately.
- Retry with feedback context, not from scratch.

Verification gates:
| Type             | SHIP? |
| execution output | Yes   |
| observation      | Yes   |
| measurement      | Yes   |
| code review      | Weak  |
| assumption       | Block |

If conversation compacts, preserve: [SESSION] marker, criteria[], mustNot[],
current work item, verification status.'

CONTEXT="$PRIMER"

if [[ -n "$TRANSCRIPT" && -f "$TRANSCRIPT" ]]; then
  ALL_TEXT=$(jq -r '
    select(.type == "assistant" or .type == "user") |
    .message.content |
    if type == "array" then [.[] | select(.type == "text") | .text] | join("\n")
    elif type == "string" then .
    else "" end
  ' "$TRANSCRIPT" 2>/dev/null || true)

  if [[ -n "$ALL_TEXT" ]]; then
    SESSION=$(echo "$ALL_TEXT" | rg -o '\[SESSION\].*' 2>/dev/null | tail -1 || true)
    OBJECTIVE=$(echo "$ALL_TEXT" | rg -o '^OBJECTIVE:.*' 2>/dev/null | tail -1 || true)
    extract_block() {
      local label="$1" max_lines="$2"
      echo "$ALL_TEXT" | awk -v label="$label" -v max="$max_lines" '
        index($0, label) == 1 { found=1; count=0 }
        found && count > 0 && /^[A-Z]/ && index($0, label) != 1 { exit }
        found && count > 0 && /^$/ { exit }
        found { print; count++; if (count >= max) exit }
      ' 2>/dev/null || true
    }

    CRITERIA=$(extract_block "criteria[]" 12)
    MUSTNOT=$(extract_block "mustNot[]" 12)
    ACCEPTANCE=$(extract_block "ACCEPTANCE" 15)
    STOP=$(extract_block "STOP CONDITIONS" 8)

    NL=$'\n'
    STATE=""
    [[ -n "$SESSION" ]] && STATE="${STATE}${NL}${SESSION}"
    [[ -n "$OBJECTIVE" ]] && STATE="${STATE}${NL}${OBJECTIVE}"
    [[ -n "$CRITERIA" ]] && STATE="${STATE}${NL}${CRITERIA}"
    [[ -n "$MUSTNOT" ]] && STATE="${STATE}${NL}${MUSTNOT}"
    [[ -n "$ACCEPTANCE" ]] && STATE="${STATE}${NL}${ACCEPTANCE}"
    [[ -n "$STOP" ]] && STATE="${STATE}${NL}${STOP}"

    if [[ -n "$STATE" ]]; then
      CONTEXT="${CONTEXT}${NL}${NL}Pipeline state:${STATE}"
    fi
  fi
fi

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

ESCAPED=$(escape_for_json "$CONTEXT")

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "<subagent-context>\n${ESCAPED}\n</subagent-context>"
  }
}
EOF

exit 0
