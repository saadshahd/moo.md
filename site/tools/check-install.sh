#!/bin/sh
# Clean-room check of the install page's one line.
#
# Reads the line from src/install.ts, where every page that shows it takes it
# from, runs it twice in an empty home that holds
# Claude Code and one other agent, and passes only when the plugins are
# enabled, the output style is set, every plugin skill has its file copy for
# other agents, and Claude's own skills folder stays absent. The second run is
# the "run it again to update" the page promises.
#
# Usage: check-install.sh [origin]
# An origin, such as http://localhost:4321, replaces the page's origin so the
# line runs against a local build before it is deployed.
set -eu

SOURCE="$(dirname "$0")/../src/install.ts"
MARKETPLACE_NAME="moo.md"
PLUGINS="hope hold hunch"
OUTPUT_STYLE="hold:Plain"
OTHER_AGENT_HOME=".codex"

fail() {
  printf 'install check failed: %s\n' "$*" >&2
  exit 1
}

page_line() {
  sed -n 's/.*"\(curl [^"]*install\.sh | sh\)".*/\1/p' "$SOURCE"
}

in_room() {
  env -i HOME="$room" PATH="$PATH" "$@"
}

installed_plugins() {
  in_room claude plugin list --json
}

line=$(page_line)
[ "$(printf '%s\n' "$line" | grep -c .)" -eq 1 ] || fail "expected one install line in $SOURCE, found: $line"
if [ $# -gt 0 ]; then
  line=$(printf '%s\n' "$line" | sed "s|https://[^/]*|$1|")
fi

room=$(mktemp -d)
trap 'rm -rf "$room"' EXIT
mkdir -p "$room/$OTHER_AGENT_HOME"

for run in first again; do
  printf 'install check, %s run: %s\n' "$run" "$line"
  in_room sh -c "$line" || fail "the $run run exited with an error"
done

plugins=$(installed_plugins)
for plugin in $PLUGINS; do
  id="$plugin@$MARKETPLACE_NAME"
  printf '%s\n' "$plugins" | jq -e --arg id "$id" 'any(.[]; .id == $id and .enabled)' >/dev/null ||
    fail "$id is not enabled"
  install_path=$(printf '%s\n' "$plugins" | jq -r --arg id "$id" '.[] | select(.id == $id) | .installPath')
  for skill in "$install_path"/skills/*/SKILL.md; do
    copy="$room/.agents/skills/$(basename "$(dirname "$skill")")/SKILL.md"
    [ -f "$copy" ] || fail "no file copy of $id skill at $copy"
  done
done

jq -e --arg style "$OUTPUT_STYLE" '.outputStyle == $style' "$room/.claude/settings.json" >/dev/null ||
  fail "outputStyle is not $OUTPUT_STYLE"

[ ! -e "$room/.claude/skills" ] || fail "skill files landed in Claude's folder: $room/.claude/skills"

printf 'install check passed: %s enabled, style %s, skill files in .agents only\n' "$PLUGINS" "$OUTPUT_STYLE"
