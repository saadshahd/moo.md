#!/usr/bin/env bash
# moo PreToolUse:ExitPlanMode hook: Two-pass gate.
# Pass 1: Denies first call to force plan coverage verification against original ask.
# Pass 2: Soft-gates on pipeline completeness (intent/shape per session type).

set -euo pipefail

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')

if [[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]]; then
  exit 0
fi

ALL_TEXT=$(jq -r '
  select(.type == "assistant" or .type == "user") |
  .message.content |
  if type == "array" then [.[] | select(.type == "text") | .text] | join("\n")
  elif type == "string" then .
  else "" end
' "$TRANSCRIPT" 2>/dev/null || true)

if [[ -z "$ALL_TEXT" ]]; then
  exit 0
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

# --- PASS 1: Coverage verification ---
# Search raw JSONL (not ALL_TEXT which skips tool_result where denial reasons appear)
COVERAGE_DONE=$(rg -c 'PLAN_COVERAGE_GATE: Before exiting plan mode' "$TRANSCRIPT" 2>/dev/null || echo "0")

if [[ "$COVERAGE_DONE" == "0" ]]; then
  FIRST_ASK=$(jq -s -r '
    [.[] | select(.type == "user") | .message.content |
      if type == "string" then .
      elif type == "array" then [.[] | select(.type == "text") | .text] | join(" ")
      else "" end
    ] | .[0] // ""
  ' "$TRANSCRIPT" 2>/dev/null || true)
  FIRST_ASK="${FIRST_ASK:0:300}"

  if [[ -n "$FIRST_ASK" ]]; then
    REASON="PLAN_COVERAGE_GATE: Before exiting plan mode, verify your plan covers the original request. Original ask: \"${FIRST_ASK}\". Review the plan file, confirm all requirements are addressed, and state what you verified. Then call ExitPlanMode again."
    ESCAPED_REASON=$(escape_for_json "$REASON")

    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "${ESCAPED_REASON}"
  }
}
EOF
    exit 0
  fi
fi

# --- PASS 2: Phase completeness ---
SESSION=$(echo "$ALL_TEXT" | rg -o '\[SESSION\].*' 2>/dev/null | tail -1 || true)

if [[ -z "$SESSION" ]]; then
  exit 0
fi

SESSION_TYPE=""
if echo "$SESSION" | rg -qi 'Type:\s*Build'; then
  SESSION_TYPE="Build"
elif echo "$SESSION" | rg -qi 'Type:\s*Debug'; then
  SESSION_TYPE="Debug"
elif echo "$SESSION" | rg -qi 'Type:\s*Plan'; then
  SESSION_TYPE="Plan"
elif echo "$SESSION" | rg -qi 'Type:\s*Reflect'; then
  SESSION_TYPE="Reflect"
fi

if [[ -z "$SESSION_TYPE" ]]; then
  exit 0
fi

extract_block() {
  local label="$1" max_lines="$2"
  echo "$ALL_TEXT" | awk -v label="$label" -v max="$max_lines" '
    index($0, label) == 1 { found=1; count=0 }
    found && count > 0 && /^[A-Z]/ && index($0, label) != 1 { exit }
    found && count > 0 && /^$/ { exit }
    found { print; count++; if (count >= max) exit }
  ' 2>/dev/null || true
}

OBJECTIVE=$(echo "$ALL_TEXT" | rg -o '^OBJECTIVE:.*' 2>/dev/null | tail -1 || true)
ACCEPTANCE=$(extract_block "ACCEPTANCE" 15)
CRITERIA=$(extract_block "criteria[]" 12)
MUSTNOT=$(extract_block "mustNot[]" 12)

MISSING=()

if [[ "$SESSION_TYPE" == "Reflect" ]]; then
  [[ -z "$OBJECTIVE" ]] && MISSING+=("intent (OBJECTIVE)")
else
  [[ -z "$OBJECTIVE" ]] && MISSING+=("intent (OBJECTIVE)")
  [[ -z "$ACCEPTANCE" ]] && MISSING+=("intent (ACCEPTANCE criteria)")
  [[ -z "$CRITERIA" ]] && MISSING+=("shape (criteria[])")
  [[ -z "$MUSTNOT" ]] && MISSING+=("shape (mustNot[])")
fi

if [[ ${#MISSING[@]} -eq 0 ]]; then
  exit 0
fi

REASON="Exiting plan mode for a ${SESSION_TYPE} session with missing pipeline phases: ${MISSING[*]}. Run the missing phases first, or proceed if intentional."
ESCAPED_REASON=$(escape_for_json "$REASON")

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "${ESCAPED_REASON}"
  }
}
EOF

exit 0
