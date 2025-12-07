#!/bin/bash
# Install moo.md for your AI coding tool.
# Usage: ./install.sh [claude|codex|cursor|copilot|all]

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

install_claude() {
  echo "Claude Code: Use plugin marketplace"
  echo "  /plugin marketplace add $SCRIPT_DIR"
  echo "  /plugin install hope@moo.md"
}

install_codex() {
  mkdir -p ~/.codex
  ln -sfn "$SCRIPT_DIR/hope/commands" ~/.codex/prompts
  ln -sfn "$SCRIPT_DIR/hope/skills" ~/.codex/skills
  echo "Codex: Installed"
}

install_cursor() {
  mkdir -p .cursor
  ln -sfn "$SCRIPT_DIR/hope/commands" .cursor/commands
  echo "Cursor: Installed (project-local)"
}

install_copilot() {
  mkdir -p .github
  ln -sfn "$SCRIPT_DIR/hope/commands" .github/prompts
  echo "Copilot: Installed (project-local)"
}

case "${1:-help}" in
  claude)  install_claude ;;
  codex)   install_codex ;;
  cursor)  install_cursor ;;
  copilot) install_copilot ;;
  all)
    install_claude
    install_codex
    install_cursor
    install_copilot
    ;;
  *)
    echo "Usage: install.sh [claude|codex|cursor|copilot|all]"
    ;;
esac
