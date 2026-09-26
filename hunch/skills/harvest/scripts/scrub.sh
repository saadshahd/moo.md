#!/bin/bash
# scrub.sh <session-id> <draft> — exit 1 and list every private term the draft names; exit 0 when it names none.
# Private: the session's folders, repo names, git remotes and the files its tools touched; this machine's user, home and git identity.
# The public repo harvest files into is not private: naming it leaks nothing.
set -euo pipefail

PUBLIC_REPO="saadshahd/moo.md"

command -v jq >/dev/null || { echo "scrub.sh: needs jq (brew install jq)" >&2; exit 2; }
[ $# -eq 2 ] || { echo "usage: scrub.sh <session-id> <draft-file>" >&2; exit 2; }
[ -f "$2" ] || { echo "scrub.sh: no draft at $2" >&2; exit 2; }

config="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
transcript=$(ls "$config"/projects/*/"$1".jsonl 2>/dev/null | head -1 || true)
[ -n "$transcript" ] || { echo "scrub.sh: no transcript for session $1 under $config/projects" >&2; exit 2; }

terms=$(mktemp)
trap 'rm -f "$terms" "$terms.f"' EXIT

# One "<source><TAB><term>" per line.
add() { [ -n "$2" ] && printf '%s\t%s\n' "$1" "$2" >> "$terms"; return 0; }

add user "$USER"
add home "$HOME"
add git-name "$(git config --global user.name || true)"
add git-email "$(git config --global user.email || true)"

cwds=$(jq -r 'select(.cwd) | .cwd' "$transcript" | sort -u)
for d in $cwds; do
  add cwd "$d"
  add cwd "~${d#"$HOME"}"
  if top=$(git -C "$d" rev-parse --show-toplevel 2>/dev/null); then
    add repo "$(basename "$top")"
    for url in $(git -C "$d" remote -v | awk '{print $2}' | sort -u); do
      add remote "$url"
      add remote "$(printf '%s' "$url" | sed -E 's#^.*[:/]([^/:]+/[^/]+)$#\1#; s#\.git$##')"
    done
  else
    add repo "$(basename "$d")"
    echo "scrub.sh: $d is gone; its git remotes are unchecked" >&2
  fi
done

jq -r '
  select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .input
  | (.file_path, .notebook_path, .path | strings),
    (.command // "" | [scan("(?:~|/)[A-Za-z0-9._-]+(?:/[A-Za-z0-9._@-]+)+")] | .[])
' "$transcript" | sort -u | while read -r p; do
  add path "$p"
  for d in $cwds; do
    case "$p" in "$d"/*/*) add path "${p#"$d"/}" ;; esac
  done
done

# Short terms match inside ordinary words; the public repo and its name are allowed.
awk -F'\t' -v pub="$PUBLIC_REPO" 'BEGIN { n = split(pub, a, "/") }
  length($2) >= 3 && tolower($2) != tolower(pub) && tolower($2) != tolower(a[n]) && tolower($2) != tolower(a[1])' "$terms" |
  sort -u > "$terms.f"

hits=$(cut -f2 "$terms.f" | grep -oiF -f - "$2" | sort -u || true)
[ -z "$hits" ] && exit 0

echo "scrub.sh: the draft names private detail:"
printf '%s\n' "$hits" | while read -r h; do
  awk -F'\t' -v h="$h" 'tolower($2) == tolower(h) { print "  " $1 ": " h; exit }' "$terms.f"
done
exit 1
