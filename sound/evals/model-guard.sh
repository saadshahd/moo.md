#!/usr/bin/env bash
# Shared eval safety guard: cheap models ONLY (never opus/fable).
# Sourced by run.sh (the install eval runner) so the allowed-model list has one definition.
assert_cheap_model() {
  case "$1" in
    haiku|sonnet|claude-haiku-*|claude-sonnet-*) ;;
    *) echo "REFUSED: evals run on haiku/sonnet only, never opus/fable (got: $1)" >&2; exit 2 ;;
  esac
}
