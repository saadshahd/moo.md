#!/bin/sh
# moo.md installer, served at https://saadshahd.github.io/moo.md/install.sh.
#
# Claude Code found: installs the plugins from the marketplace and sets the
# output style. Another agent found: copies the same plugins' skill files to
# the shared .agents folder, which Claude Code does not read, so no skill lands
# twice. Run it again to update both.
#
# Everything runs inside main, called on the last line, so a download cut short
# runs nothing. Each command reads /dev/null: under `curl | sh` stdin is this
# script.
set -eu

MARKETPLACE_SOURCE="saadshahd/moo.md"
MARKETPLACE_NAME="moo.md"
PLUGINS="hope hold hunch"
OUTPUT_STYLE="hold:Plain"
OTHER_AGENT_HOMES=".codex .cursor .copilot .gemini .config/opencode"
SKILLS_CLI="skills@latest"
SKILLS_AGENT="universal"

say() {
  printf '%s\n' "$*"
}

die() {
  printf 'moo.md install failed: %s\n' "$*" >&2
  exit 1
}

run() {
  "$@" </dev/null || die "$*"
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

has_claude_code() {
  has_command claude
}

has_other_agent() {
  for agent_home in $OTHER_AGENT_HOMES; do
    if [ -e "$HOME/$agent_home" ]; then
      return 0
    fi
  done
  return 1
}

install_plugins() {
  for plugin in $PLUGINS; do
    run claude plugin install "$plugin" --marketplace "$MARKETPLACE_SOURCE" --scope user
  done
  run claude plugin marketplace update "$MARKETPLACE_NAME"
  for plugin in $PLUGINS; do
    run claude plugin update "$plugin@$MARKETPLACE_NAME"
  done
}

settings_with_output_style() {
  if has_command jq; then
    jq --arg style "$OUTPUT_STYLE" '.outputStyle = $style' "$1"
  elif has_command node; then
    node -e '
      const [file, outputStyle] = process.argv.slice(1);
      const settings = JSON.parse(require("fs").readFileSync(file, "utf8"));
      console.log(JSON.stringify({ ...settings, outputStyle }, null, 2));
    ' "$1" "$OUTPUT_STYLE"
  else
    die "no jq or node to edit $1. Add this key to it: \"outputStyle\": \"$OUTPUT_STYLE\""
  fi
}

set_output_style() {
  settings="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
  updated=$(settings_with_output_style "$settings") || die "could not set outputStyle in $settings"
  printf '%s\n' "$updated" >"$settings"
}

install_skill_files() {
  has_command npx || die "found another agent but no npx. Install Node.js, then run this again"
  for plugin in $PLUGINS; do
    run npx --yes "$SKILLS_CLI" add "$MARKETPLACE_SOURCE/$plugin" \
      --global --agent "$SKILLS_AGENT" --skill '*' --yes
  done
}

main() {
  if ! has_claude_code && ! has_other_agent; then
    die "found no Claude Code and none of: $OTHER_AGENT_HOMES (under $HOME). For any other agent: npx $SKILLS_CLI add $MARKETPLACE_SOURCE"
  fi
  if has_claude_code; then
    install_plugins
    set_output_style
    say "Claude Code: $PLUGINS installed, output style $OUTPUT_STYLE. In an open session, run /reload-plugins."
  fi
  if has_other_agent; then
    install_skill_files
    say "Other agents: skill files copied. They drop the plugin prefix: hope:intent is intent."
  fi
}

main "$@"
