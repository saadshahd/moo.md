#!/bin/bash
# count.sh [--json] [days] [project-dir] — executor friction in one project's sessions, counted without a model.
# A project is its git root; its sessions are every transcript whose cwd sits at or under that root,
# worktrees and subagents included. Each signal prints its count, the sessions it spans, and its top groups.
# --json: the same as one object; each group carries its session ids and up to 5 calls behind it.
set -euo pipefail

command -v jq >/dev/null || { echo "count.sh: needs jq (brew install jq)" >&2; exit 2; }
json=false
[ "${1:-}" = --json ] && { json=true; shift; }
days="${1:-1}"
case "$days" in (*[!0-9]*|'') echo "count.sh: days must be a number, got $days" >&2; exit 2 ;; esac
. "$(dirname "$0")/project.sh" "${2:-.}"

# Transcript folders are named after the cwd, so a prefix finds the root, its subfolders and its worktrees;
# the cwd check in pass 1 drops a sibling project that shares the prefix.
files=$(find "$config/projects" -maxdepth 1 -type d -name "$key*" -print0 |
  xargs -0 -I{} find {} -name '*.jsonl' -mtime "-$((days + 1))")
since=$(jq -rn --argjson d "$days" 'now - $d * 86400 | todate')

# Pass 1, per file: one small event per tool call, tool result, human prompt and interrupt.
events=$(printf '%s\n' "$files" | while IFS= read -r f; do
  [ -n "$f" ] || continue
  jq -c --arg root "$root" --arg since "$since" '
    def head: gsub("^(cd [^;&]*(&&|;)\\s*)+"; "") | split(" ") | map(select(. != "")) | .[0:2] | join(" ");
    def norm: gsub("[0-9]+"; "N") | gsub("\\s+"; " ") | .[0:200];
    def text: if type == "string" then . else map(.text // "") | join(" ") end;
    select(.uuid and (.timestamp // "") >= $since and ((.cwd // "") as $c | $c == $root or ($c | startswith($root + "/"))))
    | {s: .sessionId, u: .uuid, t: .timestamp} as $m
    | if .type == "assistant" then
        .message.content[]? | select(.type == "tool_use")
        | $m + {k: "use", id, name,
                cmd: (if .name == "Bash" then (.input.command // "" | norm) else null end),
                head: (if .name == "Bash" then (.input.command // "" | head) else null end),
                path: (.input.file_path // .input.notebook_path // null),
                skill: (.input.skill // null), pat: (.input.pattern // null)}
      elif .type == "user" and (.message.content | type) == "string" and (.isMeta | not) then $m + {k: "human"}
      elif .type == "user" and (.message.content | type) == "array" then
        .message.content[]
        | if .type == "tool_result" then $m + {k: "res", id: .tool_use_id, err: (.is_error == true), txt: (.content | text | .[0:160])}
          elif .type == "text" and (.text | startswith("[Request interrupted by user")) then $m + {k: "interrupt"}
          else empty end
      else empty end
  ' "$f" 2>/dev/null || echo "count.sh: skipped unreadable $f" >&2
done)

# Pass 2: join results to calls, then count.
printf '%s\n' "$events" | jq -rs --arg root "$root" --argjson days "$days" --argjson json "$json" '
  def what: .cmd // .path // .pat // .skill // .name;
  def signal($name; $xs; $fix):
    {name: $name, fix: $fix, n: ($xs | length), sessions: ($xs | map(.s) | unique | length),
     groups: ($xs | group_by(.g)
       | map({g: (.[0].g | tostring | gsub("\\s+"; " ") | .[0:110]), n: length, sessions: (map(.s) | unique | length),
              ids: (map(.s) | unique), calls: (.[0:5] | map({s, t, what: (what | tostring | .[0:200]), result: (.r.txt // null)}))})
       | sort_by(-.sessions, -.n))};

  (unique_by([.k, .u, .id // ""]) | sort_by(.t)) as $e
  | ($e | map(select(.k == "res")) | INDEX(.id)) as $res
  | [$e[] | select(.k == "use") | . + {r: $res[.id]}] as $calls
  | "^(The user doesn.t want to proceed|Permission for this action was denied)" as $no
  # A denied question, plan or skill is the human answering, not friction.
  | ($calls | map(select((.name | test("^(AskUserQuestion|ExitPlanMode|Skill)$") | not) and (.r.txt // "" | test($no))))) as $denied
  | ($calls | map(select(.r.err and (.r.txt | test($no) | not)))) as $errs
  # A hook or the harness refusing the call, before it ran.
  | "^<tool_use_error>(Held|Blocked)|hook (error|blocked)" as $refused
  | ($errs | map(select(.r.txt | test($refused; "i")))) as $blocked
  | ($errs | map(select(.name == "Bash" and (.r.txt | test($refused; "i") | not)))) as $failed
  | ($errs | map(select((.name | test("^(Edit|MultiEdit|Write)$")) and (.r.txt | test($refused; "i") | not)))) as $rejected
  | ($calls | map(select((.name | test("^(Grep|Glob)$")) and (.r.txt // "" | test("^No (files|matches) found"))))) as $empty
  # A retry: the same command again after it failed, in the same session.
  | ($calls | map(select(.name == "Bash")) | group_by(.s)
     | map(reduce .[] as $c ({bad: {}, out: []};
         (if .bad[$c.cmd] then .out += [$c] else . end)
         | if $c.r.err then .bad[$c.cmd] = true else . end) | .out) | add // []) as $retried
  # Rediscovery: one file read in 3+ sessions.
  | ($calls | map(select(.name == "Read" and .path)) | group_by(.path)
     | map(select((map(.s) | unique | length) >= 3)) | add // []) as $reread
  # A repeated procedure: the same three command heads in a row, in 3+ sessions.
  # Looking around (grep, sed -n, cat…) is how any agent reads any repo, so it is left out.
  | ($calls | map(select(.name == "Bash" and (.head | test("^(grep|rg|sed -n|cat|head|tail|ls|find|wc|echo|jq|python3 -|cd|git (status|log|diff|show))( |$)") | not))) | group_by(.s)
     | map(. as $b | [range(0; ($b | length) - 2) | {s: $b[.].s, t: $b[.].t, name: "Bash", g: ([$b[.].head, $b[. + 1].head, $b[. + 2].head] | join(" → "))}]
           | map(select(.g | split(" → ") | unique | length > 1)) | unique_by(.g)) | add // []
     | group_by(.g) | map(select(length >= 3)) | add // []) as $seq
  # An error after a skill ran, before the next human prompt: the skill as the error'"'"'s home.
  | ($e | map(select(.k == "use" or .k == "human")) | map(. + {r: $res[.id // ""]}) | group_by(.s)
     | map(reduce .[] as $c ({sk: null, out: []};
         if $c.k == "human" then .sk = null
         elif $c.name == "Skill" then .sk = $c.skill
         elif .sk and $c.r.err then .out += [$c + {g: .sk}] else . end) | .out) | add // []) as $afterskill
  | ($e | map(select(.k == "interrupt"))) as $intr
  | {project: $root, days: $days, sessions: ($e | map(.s) | unique | length), calls: ($calls | length),
     signals: [
       signal("failed commands";       $failed   | map(. + {g: .head});              "CLAUDE.md, a script"),
       signal("retried after failing"; $retried  | map(. + {g: .head});              "CLAUDE.md, a script"),
       signal("empty searches";        $empty    | map(. + {g: .pat});               "CLAUDE.md map, file names"),
       signal("files re-read";         $reread   | map(. + {g: .path});              "CLAUDE.md, a memory note"),
       signal("edits rejected";        $rejected | map(. + {g: (.r.txt | .[0:70])}); "split the file"),
       signal("hook or gate blocks";   $blocked  | map(. + {g: (.r.txt | .[0:70])}); "the hook, or its rule"),
       signal("calls denied";          $denied   | map(. + {g: (.name + " " + (.head // .path // ""))}); ".claude/settings.json, CLAUDE.md"),
       signal("repeated sequences";    $seq;                                           "a project skill"),
       signal("errors after a skill";  $afterskill;                                    "that skill"),
       signal("interrupts";            $intr     | map(. + {g: "interrupt"});        "read the turns")
     ] | map(select(.n > 0))}
  | if $json then . else
      "project \(.project), last \(.days) day(s): \(.sessions) session(s), \(.calls) tool calls",
      (.signals[] | "\(.name)  \(.n) in \(.sessions) session(s)  → \(.fix)",
        (.groups[0:3][] | "    \(.n)× (\(.sessions) sess)  \(.g)"))
    end
'
