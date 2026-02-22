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

If conversation compacts, preserve: [SESSION] marker, criteria[], holdout[],
mustNot[], current work item, satisfaction score.'

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
    HOLDOUT=$(extract_block "holdout[]" 12)
    MUSTNOT=$(extract_block "mustNot[]" 12)
    ACCEPTANCE=$(extract_block "ACCEPTANCE" 15)
    STOP=$(extract_block "STOP CONDITIONS" 8)

    PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
    IS_HOLDOUT_VERIFY=false
    if echo "$PROMPT" | rg -q 'HOLDOUT-VERIFY' 2>/dev/null; then
      IS_HOLDOUT_VERIFY=true
    fi

    NL=$'\n'
    STATE=""
    [[ -n "$SESSION" ]] && STATE="${STATE}${NL}${SESSION}"
    [[ -n "$OBJECTIVE" ]] && STATE="${STATE}${NL}${OBJECTIVE}"

    if [[ "$IS_HOLDOUT_VERIFY" == "true" ]]; then
      # Verification subagent: sees holdout + mustNot, NOT criteria
      [[ -n "$HOLDOUT" ]] && STATE="${STATE}${NL}${HOLDOUT}"
    else
      # Generation subagent: sees criteria + mustNot, NOT holdout
      [[ -n "$CRITERIA" ]] && STATE="${STATE}${NL}${CRITERIA}"
    fi

    [[ -n "$MUSTNOT" ]] && STATE="${STATE}${NL}${MUSTNOT}"
    [[ -n "$ACCEPTANCE" ]] && STATE="${STATE}${NL}${ACCEPTANCE}"
    [[ -n "$STOP" ]] && STATE="${STATE}${NL}${STOP}"

    if [[ -n "$STATE" ]]; then
      CONTEXT="${CONTEXT}${NL}${NL}Pipeline state:${STATE}"
    fi

    # Warn when transcript exists but key pipeline state is missing
    MISSING=""
    [[ -z "$SESSION" ]] && MISSING="${MISSING}SESSION "
    if [[ "$IS_HOLDOUT_VERIFY" == "true" ]]; then
      [[ -z "$HOLDOUT" ]] && MISSING="${MISSING}holdout[] "
    else
      [[ -z "$CRITERIA" ]] && MISSING="${MISSING}criteria[] "
    fi
    [[ -z "$MUSTNOT" ]] && MISSING="${MISSING}mustNot[] "
    if [[ -n "$MISSING" ]]; then
      CONTEXT="${CONTEXT}${NL}${NL}Warning: Pipeline state extraction partial — missing: ${MISSING%. }. Subagent operating with primer only for those fields."
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
