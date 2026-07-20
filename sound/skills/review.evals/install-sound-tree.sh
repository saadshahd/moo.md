#!/bin/sh
# install-sound-tree.sh <target-repo-dir> [corpus-dir]
# Install the FULL sound corpus into <target-repo>/.claude/sound/, topic-routed the
# same way sound:setup emits it post-#170 collapse: corpus/<rule>.md -> .claude/sound/<topic>/<rule>.md,
# keyed on each rule's own `topic:` frontmatter (the only field setup routes on).
#
# WHY full corpus, not a setup-selected subset: this harness measures sound:review's recall
# GIVEN the bearing rule is present. Installing everything removes setup's selection as a
# confound — a miss here is review's miss, never "setup didn't pick the rule". Measuring the
# setup∘review pipeline is a different question, deliberately out of this fence.
set -eu

target="${1:?usage: install-sound-tree.sh <target-repo-dir> [corpus-dir]}"
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
corpus="${2:-$here/../../corpus}"

[ -d "$corpus" ] || { echo "corpus not found: $corpus" >&2; exit 1; }

dest="$target/.claude/sound"
rm -rf "$dest"
count=0
for f in "$corpus"/*.md; do
  topic=$(sed -n 's/^topic:[[:space:]]*//p' "$f" | head -n1)
  [ -n "$topic" ] || { echo "rule missing topic: $f" >&2; exit 1; }
  mkdir -p "$dest/$topic"
  cp "$f" "$dest/$topic/$(basename "$f")"
  count=$((count + 1))
done
echo "installed $count rules into $dest" >&2
