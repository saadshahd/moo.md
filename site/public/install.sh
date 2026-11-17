#!/bin/sh
# moo.md installer, served at https://saadshahd.github.io/moo.md/install.sh.
#
# Claude Code found: installs the plugins from the marketplace, turns on its
# auto-update and sets the output style. Another agent found: copies the same
# plugins' skill files to the shared .agents folder, which Claude Code does not
# read, so no skill lands twice. Run it again to update both.
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

# Claude Code leaves auto-update off for every marketplace Anthropic does not
# run. A missing marketplace entry takes its source from known_marketplaces.json,
# $2, so no entry is written without one.
settings_with_style_and_auto_update() {
  if has_command jq; then
    jq --arg style "$OUTPUT_STYLE" --arg name "$MARKETPLACE_NAME" --slurpfile known "$2" '
      .outputStyle = $style
      | .extraKnownMarketplaces[$name] = (.extraKnownMarketplaces[$name] // {source: $known[0][$name].source})
      | if .extraKnownMarketplaces[$name].source == null then error("no source for \($name)") else . end
      | .extraKnownMarketplaces[$name].autoUpdate = true
    ' "$1"
  elif has_command node; then
    node -e '
      const fs = require("fs");
      const [file, knownFile, outputStyle, name] = process.argv.slice(1);
      const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
      const settings = read(file);
      const known = read(knownFile);
      const marketplaces = settings.extraKnownMarketplaces ?? {};
      const entry = marketplaces[name] ?? { source: known[name]?.source };
      if (entry.source == null) throw new Error("no source for " + name);
      const extraKnownMarketplaces = { ...marketplaces, [name]: { ...entry, autoUpdate: true } };
      console.log(JSON.stringify({ ...settings, outputStyle, extraKnownMarketplaces }, null, 2));
    ' "$1" "$2" "$OUTPUT_STYLE" "$MARKETPLACE_NAME"
  else
    die "no jq or node to edit $1. Set \"outputStyle\": \"$OUTPUT_STYLE\" in it, and \"autoUpdate\": true in the \"$MARKETPLACE_NAME\" entry of extraKnownMarketplaces"
  fi
}

set_style_and_auto_update() {
  config="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
  settings="$config/settings.json"
  updated=$(settings_with_style_and_auto_update "$settings" "$config/plugins/known_marketplaces.json") ||
    die "could not set outputStyle and auto-update in $settings"
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
    set_style_and_auto_update
    say "Claude Code: $PLUGINS installed, auto-update on, output style $OUTPUT_STYLE. In an open session, run /reload-plugins."
  fi
  if has_other_agent; then
    install_skill_files
    say "Other agents: skill files copied. They drop the plugin prefix: hope:intent is intent."
  fi
}

main "$@"
