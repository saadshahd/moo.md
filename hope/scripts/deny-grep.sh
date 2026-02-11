#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qP '(?<![a-z_-])grep(?![a-z_-])'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Use sg (ast-grep) or rg (ripgrep) instead of grep — faster and respects .gitignore. Run Skill(skill="hope:search") to know more"
    }
  }'
fi
