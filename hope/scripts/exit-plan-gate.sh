#!/usr/bin/env bash
# moo PreToolUse:ExitPlanMode hook: Sequential deny chain.
# Checks pipeline artifacts in order, denies on first missing.
# Coverage verification as final gate. Max 3 denials.

set -euo pipefail

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')

[[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]] && exit 0

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

deny() {
  local reason="$1"
  local escaped
  escaped=$(escape_for_json "$reason")
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "${escaped}"
  }
}
EOF
  exit 0
}

has_artifact() {
  local count
  count=$(rg -c "$1" "$TRANSCRIPT" 2>/dev/null || echo "0")
  [[ "$count" != "0" ]]
}

# --- Max denial cap: prevent infinite loops ---
DENY_COUNT=$(rg -c 'DENY_CHAIN_GATE:' "$TRANSCRIPT" 2>/dev/null || echo "0")
if [[ "$DENY_COUNT" -ge 3 ]]; then
  MISSING_LIST=""
  has_artifact 'OBJECTIVE:' || MISSING_LIST="${MISSING_LIST}OBJECTIVE "
  has_artifact 'ACCEPTANCE' || MISSING_LIST="${MISSING_LIST}ACCEPTANCE "
  has_artifact 'criteria\[\]' || MISSING_LIST="${MISSING_LIST}criteria[] "
  has_artifact 'mustNot\[\]' || MISSING_LIST="${MISSING_LIST}mustNot[] "
  if [[ -n "$MISSING_LIST" ]]; then
    WARN="PLAN_GATE_OVERRIDE: Max denials reached. Missing artifacts: ${MISSING_LIST%. }. Proceeding without full pipeline coverage."
    ESCAPED_WARN=$(escape_for_json "$WARN")
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "${ESCAPED_WARN}"
  }
}
EOF
  fi
  exit 0
fi

# --- Parse [SESSION] marker from assistant messages ---
SESSION=$(jq -r '
  select(.type == "assistant") |
  .message.content |
  if type == "array" then [.[] | select(.type == "text") | .text] | join("\n")
  elif type == "string" then .
  else "" end
' "$TRANSCRIPT" 2>/dev/null | rg -o '\[SESSION\].*' 2>/dev/null | tail -1 || true)

[[ -z "$SESSION" ]] && exit 0

# --- Derive required phases from marker ---
HAS_CLARIFY=false
HAS_SHAPE=false

PIPELINE=$(echo "$SESSION" | rg -o 'Pipeline:\s*[^|]+' 2>/dev/null | sed 's/Pipeline:[[:space:]]*//' || true)

if [[ -n "$PIPELINE" ]]; then
  echo "$PIPELINE" | rg -qi 'clarify|intent' && HAS_CLARIFY=true
  echo "$PIPELINE" | rg -qi 'shape' && HAS_SHAPE=true
else
  TYPE=$(echo "$SESSION" | rg -o 'Type:\s*\w+' 2>/dev/null | sed 's/Type:[[:space:]]*//' || true)
  case "$TYPE" in
    Build|Debug|Plan) HAS_CLARIFY=true; HAS_SHAPE=true ;;
    Reflect)          HAS_CLARIFY=true; HAS_SHAPE=false ;;
    *)                exit 0 ;;
  esac
fi

[[ "$HAS_CLARIFY" == "false" && "$HAS_SHAPE" == "false" ]] && exit 0

# --- Sequential deny chain: first missing artifact stops ---

if [[ "$HAS_CLARIFY" == "true" ]]; then
  has_artifact 'OBJECTIVE:' || \
    deny "DENY_CHAIN_GATE: Intent phase incomplete. Emit OBJECTIVE: and ACCEPTANCE criteria before exiting plan mode. Run Skill(skill=\"hope:intent\") or produce the intent brief manually."

  has_artifact 'ACCEPTANCE' || \
    deny "DENY_CHAIN_GATE: Intent brief missing ACCEPTANCE criteria. Emit ACCEPTANCE block (7-12 testable bullets, ≥2 with \"must NOT\") before exiting plan mode."
fi

if [[ "$HAS_SHAPE" == "true" ]]; then
  has_artifact 'criteria\[\]' || \
    deny "DENY_CHAIN_GATE: Shape phase not found. Emit criteria[] and mustNot[] blocks before exiting plan mode. Run Skill(skill=\"hope:shape\") or produce boolean pass/fail criteria manually."

  has_artifact 'mustNot\[\]' || \
    deny "DENY_CHAIN_GATE: Shape output missing mustNot[] block. Emit mustNot[] (≥2 inviolable constraints) alongside criteria[] before exiting plan mode."
fi

# --- Self-containment: Plan sessions must be execution protocols ---
if [[ "$HAS_SHAPE" == "true" ]]; then
  SESSION_TYPE=$(echo "$SESSION" | rg -o 'Type:\s*\w+' 2>/dev/null | sed 's/Type:[[:space:]]*//' || true)
  if [[ "$SESSION_TYPE" == "Plan" ]]; then
    HAS_SKILL_REFS=$(rg -c 'Skill(skill=' "$TRANSCRIPT" 2>/dev/null || echo "0")
    if [[ "$HAS_SKILL_REFS" == "0" ]]; then
      has_artifact 'trivial\|single.*action' || \
        deny "DENY_CHAIN_GATE: PLAN_SELF_CONTAINED: Plan output must be an execution protocol. Include Skill() invocations for deferred actions so a fresh session can execute without knowing the pipeline. If genuinely trivial, state that explicitly."
    fi
  fi
fi

# --- Final gate: coverage verification ---
has_artifact 'PLAN_COVERAGE_GATE:' && exit 0

FIRST_ASK=$(jq -s -r '
  [.[] | select(.type == "user") | .message.content |
    if type == "string" then .
    elif type == "array" then [.[] | select(.type == "text") | .text] | join(" ")
    else "" end
  ] | .[0] // ""
' "$TRANSCRIPT" 2>/dev/null || true)
FIRST_ASK="${FIRST_ASK:0:300}"

[[ -z "$FIRST_ASK" ]] && exit 0

deny "DENY_CHAIN_GATE: PLAN_COVERAGE_GATE: Before exiting plan mode, verify your plan covers the original request. Original ask: \"${FIRST_ASK}\". Review the plan file, confirm all requirements are addressed, and state what you verified. Then call ExitPlanMode again."
