#!/usr/bin/env bash
# Runs the stale-name gate against throwaway repos, one case per behaviour it must keep.
set -euo pipefail
gate=$(cd "$(dirname "$0")/../corpus/naming" && pwd)/rename-leaves-no-stale-name.gate
source "$(dirname "$0")/gate-lib.sh"

check() { # check <warn|quiet> <name>: the gate never blocks, so the outcome is whether it lists lines
  local status=0 got
  /bin/bash "$gate" 2>"$err" || status=$?
  if grep -q 'crashed at line' "$err"; then got=crash
  elif [ "$status" -ne 0 ]; then got=block
  elif [ -s "$err" ]; then got=warn
  else got=quiet; fi
  if [ "$got" = "$1" ]; then echo "ok   $2"; else echo "FAIL $2 (got $got)"; cat "$err"; fails=$((fails + 1)); fi
}

put() { mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" >"$1"; git add "$1"; }
commit() { git commit -qm c; }
renamed() { repo; put src/a.ts 'export function parseConfig() {}'; put "$1" "$2"; commit; put src/a.ts 'export function loadConfig() {}'; }

renamed README.md 'Call parseConfig to start.'; check warn 'old name left in a doc'
renamed README.md 'Call parseConfig to start.'; grep -q 'README.md:1  (parseConfig)' <(/bin/bash "$gate" 2>&1 || true) && echo 'ok   message names file, line and name' || { echo 'FAIL message'; fails=$((fails + 1)); }
renamed README.md 'Call parseConfig to start.'; put README.md 'Call loadConfig to start.'; check quiet 'doc renamed in the same commit'
renamed src/b.ts 'log("parseConfig failed");'; check quiet 'old name in a string: strings reuse names for queries and events'
renamed src/b.ts 'const q = `query parseConfig { id }`;'; check quiet 'old name in a template literal'
renamed src/b.ts '// parseConfig reads the file'; check warn 'old name in a comment'
renamed src/b.ts 'import { parseConfig } from "./a"; parseConfig();'; check quiet 'old name used as code: the type checker owns it'
renamed CHANGELOG.md 'Renamed parseConfig to loadConfig.'; check quiet 'old name in a changelog'
renamed src/b.swift 'func parseConfig() {}'; check quiet 'old name in another language'
renamed src/b.ts 'class A { #kindOf(parseConfig: string) {} }'; check quiet 'old name after a private field'
repo; put dist/app.js 'export function parseConfig() {}'; put README.md 'parseConfig'; commit; git rm -q dist/app.js; check quiet 'build output removed'
repo; put src/dates/old.ts 'export {}'; put package.json '{"main": "src/dates/old.ts"}'; commit; git mv src/dates/old.ts src/dates/new.ts; check warn 'old path left in config'
repo; put src/dates/old.ts 'export {}'; put scripts/run.ts 'spawn("tsx", ["src/dates/old.ts"]);'; commit; git mv src/dates/old.ts src/dates/new.ts; check warn 'old path left in a string'
renamed test/fixtures/notes.md 'parseConfig'; check quiet 'old name in a fixture'
renamed docs/x.md 'parseConfig'; echo 'docs/** linguist-generated' >.gitattributes; git add .gitattributes; check quiet 'old name in a generated file'
renamed README.md 'parseConfig'; put src/c.ts 'export const parseConfig = 1;'; check quiet 'old name still declared elsewhere'
renamed README.md 'graph.parseConfig()'; put src/c.ts 'class Graph { parseConfig() {} }'; check quiet 'old name lives on as a method'
renamed README.md 'parseConfig'; put src/c.ts '/* parseConfig */ export const x = parseConfig;'; check quiet 'old name still used as code after a comment'
repo; put src/a.ts 'export function parseConfig() {}'; put README.md 'parseConfig'; commit; git rm -q src/a.ts; put src/b.ts 'export function parseConfig() {}'; check quiet 'declaration moved to another file'
repo; put src/a.ts 'export function parseConfig() {}'; put README.md 'parseConfig'; commit; git rm -q src/a.ts; check warn 'declaration deleted, doc still names it'
repo; put src/a.ts 'export function parse() {}'; put README.md 'parse it'; commit; put src/a.ts 'export function load() {}'; check quiet 'one-word name'
repo; put src/a.ts $'function run() {\n  const parseConfig = 1;\n}'; put README.md 'parseConfig'; commit; put src/a.ts 'function run() {}'; check quiet 'local variable removed'
repo; put src/a.ts 'const parseConfig = 1;'; put README.md 'parseConfig'; commit; put src/a.ts 'const loadConfig = 1;'; check quiet 'unexported top-level const'
renamed README.md $'```ts\nfunction parseConfig() {}\n```'; check quiet 'doc that declares the name in its own example'
repo; put src/a.ts 'export const MAX_RETRIES = 3;'; put README.md 'Set MAX_RETRIES.'; commit; put src/a.ts 'export const RETRY_LIMIT = 3;'; check warn 'snake-case name'
repo; put src/dates/old.ts 'export {}'; put README.md 'See src/dates/old.ts.'; commit; git mv src/dates/old.ts src/dates/new.ts; check warn 'old path left in a doc'
repo; put src/dates/old.ts 'export {}'; put README.md 'See src/dates/old.ts.'; commit; git mv src/dates/old.ts src/dates/new.ts; put README.md 'See src/dates/new.ts.'; check quiet 'doc path updated'
repo; put src/dates/old.ts 'export {}'; put README.md 'See lib/src/dates/old.ts.'; commit; git mv src/dates/old.ts src/dates/new.ts; check quiet 'longer path that only ends the same'
repo; put old.ts 'export {}'; put README.md 'old.ts'; commit; git mv old.ts new.ts; check quiet 'root-level file rename'
repo; put 'src/my dir/old.ts' 'export {}'; put README.md 'src/my dir/old.ts'; commit; git mv 'src/my dir/old.ts' 'src/my dir/new.ts'; check warn 'path with a space'
repo; put src/a.ts 'export function parseConfig() {}'; put README.md 'parseConfig'; commit; put src/a.ts 'export function parseConfig(x) { return x; }'; check quiet 'declaration edited in place'

finish
