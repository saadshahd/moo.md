#!/bin/bash
# read.sh <session-id> [turn] — a session as numbered turns, with the marks harvest cites.
# With a turn number: that one turn, nothing cut.
# A turn is one user prompt or the agent's whole reply to it; its number is what a report cites.
# Marks: [skill] a hope:/hunch:/hold: skill ran; [work-start] the first file change; [ask] a question and its answer.
set -euo pipefail

command -v jq >/dev/null || { echo "read.sh: needs jq (brew install jq)" >&2; exit 2; }
[ $# -eq 1 ] || [ $# -eq 2 ] || { echo "usage: read.sh <session-id> [turn]" >&2; exit 2; }
turn="${2:-0}"
case "$turn" in (*[!0-9]*|'') echo "read.sh: turn must be a number, got $turn" >&2; exit 2 ;; esac

config="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
transcript=$(ls "$config"/projects/*/"$1".jsonl 2>/dev/null | head -1 || true)
[ -n "$transcript" ] || { echo "read.sh: no transcript for session $1 under $config/projects" >&2; exit 1; }

jq -rs --argjson turn "$turn" '
  def moo: test("^/?(hope|hunch|hold):");
  def cut($n): if $turn == 0 and length > $n then .[0:$n] + " … (read.sh <id> <turn> prints it whole)" else . end;
  def oneline: gsub("\\s+"; " ");
  # Newer transcripts tag each prompt with .origin; older ones carry none, so fall back to its text.
  def human($tagged):
    .type == "user" and (.isMeta | not) and (.isSidechain | not) and
    (if $tagged then .origin.kind? == "human"
     else (.message.content | type) == "string" and ((.message.content | startswith("<") | not) or (.message.content | startswith("<command-")))
     end);
  def prompt:
    (.message.content | if type == "string" then . else map(select(.type == "text") | .text) | join(" ") end) as $t
    | ($t | capture("<command-name>(?<n>[^<]*)</command-name>").n // null) as $cmd
    | if $cmd then ($cmd + " " + ($t | capture("<command-args>(?<a>[\\s\\S]*?)</command-args>").a // "")) | (if $cmd | moo then . + "  [skill]" else . end)
      else $t end;
  # Scratch notes, plans and memory change no work product.
  def scratch: test("^(/tmp/|/private/tmp/|/var/folders/)|/\\.claude/(plans|projects)/");
  def changes_files:
    ((.name | test("^(Edit|MultiEdit|Write|NotebookEdit)$")) and ((.input.file_path // .input.notebook_path // "") | scratch | not)) or
    (.name == "Bash" and (.input.command // "" | test("(^|[;&|(]\\s*)(rm|mv|cp|mkdir|touch|tee|ln|sed -i|perl -pi|git (commit|add|checkout|switch|reset|restore|apply|mv|rm|stash|merge|rebase|cherry-pick|push|worktree add))\\b|(^|[^0-9&>])>>?\\s*(?!/dev/null)[^\\s&|]")));
  def brief:
    .name + " " + (.input | (.skill // .file_path // .notebook_path // .command // .pattern // .description // .prompt // .url // "") | tostring | oneline | cut(120));

  # A resumed or rewound session rewrites earlier lines under new uuids; the same time and content is one line.
  (map(select(.uuid)) | unique_by([.timestamp, .type, (.message.content | tostring)]) | sort_by(.timestamp)) as $e
  | any($e[]; .origin) as $tagged
  | ([ $e[] | select(.type == "user" and (.message.content | type) == "array") | .message.content[]
       | select(.type == "tool_result") | {key: .tool_use_id, value: (.content | if type == "string" then . else map(.text // "") | join(" ") end)} ]
     | from_entries) as $results
  | reduce ($e[] | select((.isSidechain | not) and (human($tagged) or .type == "assistant"))) as $x
      ({n: 0, side: "", started: false, out: []};
       if ($x | human($tagged)) then
         .n += 1 | .side = "user" | .out += [{n: .n, line: "\n\(.n) USER  " + ($x | prompt | gsub("\n"; "\n      "))}]
       else
         (if .side != "agent" then .n += 1 | .side = "agent" | .out += [{n: .n, line: "\n\(.n) AGENT"}] else . end)
         | reduce ($x.message.content[]?) as $b (.;
             if $b.type == "text" then .out += [{n: .n, line: ("  " + ($b.text | oneline | cut(500)))}]
             elif $b.type == "tool_use" then
               ($b | brief) as $line
               | if $b.name == "AskUserQuestion" then
                   .out += [{n: .n, line: ("  [ask] " + ($b.input.questions // [] | map(.question) | join(" / ") | oneline))},
                            {n: .n, line: ("  [answer] " + ($results[$b.id] // "(no answer recorded)" | oneline))}]
                 elif $b.name == "Skill" and ($b.input.skill // "" | moo) then .out += [{n: .n, line: ("  [skill] " + $line)}]
                 elif ($b | changes_files) and (.started | not) then .started = true | .out += [{n: .n, line: ("  [work-start] " + $line)}]
                 else .out += [{n: .n, line: ("  · " + $line)}] end
             else . end)
       end)
  | [.out[] | select($turn == 0 or .n == $turn) | .line]
  | if length == 0 then error("no turn \($turn)") else .[] end
' "$transcript" > "${TMPDIR:-/tmp}/harvest-read.$$" || { echo "read.sh: jq failed on $transcript" >&2; exit 1; }

if [ "$turn" -ne 0 ]; then
  cat "${TMPDIR:-/tmp}/harvest-read.$$"; rm -f "${TMPDIR:-/tmp}/harvest-read.$$"; exit 0
fi

echo "session $1"
echo "cwd $(jq -r 'select(.cwd) | .cwd' "$transcript" | sort -u | paste -sd' ' -)"

echo "installed moo plugins:"
plugins="$config/plugins/installed_plugins.json"
if [ -f "$plugins" ]; then
  jq -r '.plugins | to_entries[] | select(.key | endswith("@moo.md")) | .value[] | select(.scope == "user") | .installPath' "$plugins" |
  while read -r p; do
    skills=$(ls "$p/skills" 2>/dev/null | paste -sd' ' -)
    hooks=$(jq -c '.modules // (.hooks | keys) // empty' "$p/hooks/hooks.json" 2>/dev/null || true)
    echo "  $(basename "$(dirname "$p")") $(basename "$p")  skills: ${skills:-none}  hooks: ${hooks:-none}"
  done
else
  echo "  (no $plugins)"
fi

cat "${TMPDIR:-/tmp}/harvest-read.$$"
rm -f "${TMPDIR:-/tmp}/harvest-read.$$"
