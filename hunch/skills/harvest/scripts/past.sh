#!/bin/bash
# past.sh — every harvest issue, open or closed: number, state, title, and each comment passage that says when to reopen it.
# A flow one of these already names is a new case for it, not a new issue.
set -euo pipefail

REPO="saadshahd/moo.md"

command -v gh >/dev/null || { echo "past.sh: needs gh (brew install gh)" >&2; exit 2; }
[ $# -eq 0 ] || { echo "usage: past.sh" >&2; exit 2; }

# A passage runs from the line that names a reopen (or open check) to the paragraph's end: "Reopen when:" lists its cases below.
gh issue list -R "$REPO" --label harvest --state all --limit 500 --json number,state,title,comments --jq '
  def reopen: test("reopen|open check"; "i");
  sort_by(.number)[]
  | "#\(.number) \(.state) \(.title)",
    (.comments[].body | gsub("\r"; "") | split("\n\n")[] | split("\n") | select(any(.[]; reopen))
     | . as $ls | first(range(0; $ls | length) | select($ls[.] | reopen)) as $i
     | "    " + ($ls[$i:] | join(" ") | gsub("\\s+"; " ") | .[0:500]))
' || { echo "past.sh: gh could not list harvest issues in $REPO" >&2; exit 1; }
