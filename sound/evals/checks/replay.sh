#!/usr/bin/env bash
# Runs a gate over every single-parent commit of a repo as if that commit were being staged.
# usage: replay.sh <gate> <repo>   Prints each blocked commit with the gate's message, then the totals.
set -euo pipefail
gate=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
replay=$(mktemp -d "${TMPDIR:-/tmp}/gate-replay.XXXXXX")
git clone -q --no-checkout "$2" "$replay"
cd "$replay"
commits=0 blocked=0
for commit in $(git rev-list --no-merges --max-parents=1 --min-parents=1 HEAD); do
  commits=$((commits + 1))
  git update-ref --no-deref HEAD "$commit^"
  git read-tree "$commit"
  verdict=$(/bin/bash "$gate" 2>&1 >/dev/null) && continue
  blocked=$((blocked + 1))
  echo "BLOCK $commit"
  echo "$verdict" | sed -n '2,/^$/p'
done
echo "commits=$commits blocked=$blocked"
