#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || exit 0)"
ROADMAP="${REPO_ROOT}/ROADMAP.md"

[[ -f "$ROADMAP" ]] || exit 0

PENDING=$(grep -c '^\- \[ \]' "$ROADMAP" 2>/dev/null || true)

[[ "$PENDING" -gt 0 ]] || exit 0

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Roadmap: ${PENDING} pending items. Read ROADMAP.md to review."
  }
}
EOF

exit 0
