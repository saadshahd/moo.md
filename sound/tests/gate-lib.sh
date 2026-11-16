#!/usr/bin/env bash
# Sourced by the gate tests: throwaway repos and one expectation per behaviour.
# Set `gate` to the gate under test before calling expect.
fails=0
err=$(mktemp "${TMPDIR:-/tmp}/gate-err.XXXXXX")

repo() {
  cd "$(mktemp -d "${TMPDIR:-/tmp}/gate-repo.XXXXXX")"
  git init -q && git config user.email t@t && git config user.name t
  git commit -q --allow-empty -m root
}

expect() { # expect <block|pass> <name>
  local got=pass
  /bin/bash "$gate" 2>"$err" || got=block
  if grep -q 'crashed at line' "$err"; then echo "FAIL $2 (the gate crashed and failed open)"; cat "$err"; fails=$((fails + 1))
  elif [ "$got" = "$1" ]; then echo "ok   $2"; else echo "FAIL $2 (got $got)"; cat "$err"; fails=$((fails + 1)); fi
}

finish() {
  [ "$fails" -eq 0 ] && echo 'all passed' || { echo "$fails failed"; exit 1; }
}
