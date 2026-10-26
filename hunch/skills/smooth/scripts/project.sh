# project.sh — sourced: sets root (the git root of $1, default .), config, key (root as Claude Code
# names its transcript folder) and mem (the project's auto-memory folder). Fails when $1 is not in a repo.
root=$(git -C "${1:-.}" rev-parse --show-toplevel 2>/dev/null) || { echo "smooth: ${1:-.} is not in a git repo" >&2; exit 2; }
config="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
key=$(printf %s "$root" | sed 's/[^A-Za-z0-9]/-/g')
mem="$config/projects/$key/memory"
