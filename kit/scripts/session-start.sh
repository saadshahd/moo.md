#!/usr/bin/env bash
# Discovers running kit services and injects as session context.
# Fires on startup|resume|clear|compact — rediscovers from system each time.

set -euo pipefail

env_lines=""

if command -v portless &>/dev/null; then
  routes=$(portless list 2>/dev/null | grep -E '^\s+http' || true)
  if [ -n "$routes" ]; then
    env_lines="${env_lines}## Active Services (portless)\n${routes}\n\n"
  fi
fi

if command -v d3k &>/dev/null; then
  cdp_port=$(d3k cdp-port 2>/dev/null || true)
  if [ -n "$cdp_port" ]; then
    env_lines="${env_lines}## d3k Monitoring Active\n"
    env_lines="${env_lines}- CDP port: ${cdp_port}\n"
    env_lines="${env_lines}- Snapshot: d3k agent-browser --cdp ${cdp_port} snapshot -i\n"
    env_lines="${env_lines}- Screenshot: d3k agent-browser --cdp ${cdp_port} screenshot /tmp/page.png\n"
    env_lines="${env_lines}- Errors: d3k errors --context\n"
  fi
fi

if [ -z "$env_lines" ]; then
  echo '{}'
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

escaped=$(escape_for_json "$(printf '%b' "$env_lines")")

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<kit-environment>\n${escaped}\n</kit-environment>"
  }
}
EOF

exit 0
