#!/usr/bin/env bash
# Read-only shim for gh and curl, copied under both names ahead of the real tools on PATH in every trial.
# A run holds this machine's GitHub login, so a request that is not a read is refused here, whatever the model was told.
set -euo pipefail
tool=$(basename "$0")
refuse() { echo "read-only shim: $tool refused: $1" >&2; exit 126; }
is_get() { [ "$(printf %s "$1" | tr '[:lower:]' '[:upper:]')" = GET ]; }

check_gh_api() {
  local method="" fields=0 i
  local args=("$@")
  for ((i = 0; i < ${#args[@]}; i++)); do
    case "${args[i]}" in
      -X|--method) method="${args[i+1]:-}" ;;
      --method=*) method="${args[i]#--method=}" ;;
      -X?*) method="${args[i]#-X}" ;;
      -f|-F|--field|--raw-field|-f?*|-F?*|--field=*|--raw-field=*) fields=1 ;;
      --input|--input=*) refuse "--input sends a request body" ;;
      graphql) refuse "graphql is not a read" ;;
    esac
  done
  if [ -n "$method" ] && ! is_get "$method"; then refuse "method $method"; fi
  if [ -z "$method" ] && [ "$fields" = 1 ]; then refuse "-f and -F fields make gh send a POST; add -X GET"; fi
}

check_gh() {
  case "${1:-}" in
    api) shift; check_gh_api "$@" ;;
    search|--version|version) ;;
    repo) [ "${2:-}" = view ] || refuse "only repo view" ;;
    *) refuse "only api, search and repo view" ;;
  esac
}

check_curl() {
  local i args=("$@")
  for ((i = 0; i < ${#args[@]}; i++)); do
    case "${args[i]}" in
      -X|--request) is_get "${args[i+1]:-}" || refuse "method ${args[i+1]:-}" ;;
      --request=*) is_get "${args[i]#--request=}" || refuse "method ${args[i]#--request=}" ;;
      --data|--data-*|--json|--form|--form-*|--upload-file|--config) refuse "${args[i]} sends or loads a body" ;;
      --*) ;;
      -*[dFTKX]*) refuse "${args[i]} sends a body, a method or a config" ;;
    esac
  done
}

"check_$tool" "$@"
real=$(PATH="$REAL_PATH" command -v "$tool")
exec "$real" "$@"
