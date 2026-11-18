#!/usr/bin/env bash
# Runs the stale-name gate against throwaway repos, one case per behaviour it must keep.
set -euo pipefail
gate=$(cd "$(dirname "$0")/../corpus/naming" && pwd)/rename-leaves-no-stale-name.gate
source "$(dirname "$0")/gate-lib.sh"

put() { mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" >"$1"; git add "$1"; }
commit() { git commit -qm c; }
renamed() { repo; put src/a.ts 'export function parseConfig() {}'; put "$1" "$2"; commit; put src/a.ts 'export function loadConfig() {}'; }

renamed README.md 'Call parseConfig to start.'; expect block 'old name left in a doc'
renamed README.md 'Call parseConfig to start.'; grep -q 'README.md:1  (parseConfig)' <(/bin/bash "$gate" 2>&1 || true) && echo 'ok   message names file, line and name' || { echo 'FAIL message'; fails=$((fails + 1)); }
renamed README.md 'Call parseConfig to start.'; put README.md 'Call loadConfig to start.'; expect pass 'doc renamed in the same commit'
renamed src/b.ts 'log("parseConfig failed");'; expect pass 'old name in a string: strings reuse names for queries and events'
renamed src/b.ts 'const q = `query parseConfig { id }`;'; expect pass 'old name in a template literal'
renamed src/b.ts '// parseConfig reads the file'; expect block 'old name in a comment'
renamed src/b.ts 'import { parseConfig } from "./a"; parseConfig();'; expect pass 'old name used as code: the type checker owns it'
renamed CHANGELOG.md 'Renamed parseConfig to loadConfig.'; expect pass 'old name in a changelog'
renamed src/b.swift 'func parseConfig() {}'; expect pass 'old name in another language'
renamed src/b.ts 'class A { #kindOf(parseConfig: string) {} }'; expect pass 'old name after a private field'
repo; put dist/app.js 'export function parseConfig() {}'; put README.md 'parseConfig'; commit; git rm -q dist/app.js; expect pass 'build output removed'
repo; put src/dates/old.ts 'export {}'; put package.json '{"main": "src/dates/old.ts"}'; commit; git mv src/dates/old.ts src/dates/new.ts; expect block 'old path left in config'
repo; put src/dates/old.ts 'export {}'; put scripts/run.ts 'spawn("tsx", ["src/dates/old.ts"]);'; commit; git mv src/dates/old.ts src/dates/new.ts; expect block 'old path left in a string'
renamed test/fixtures/notes.md 'parseConfig'; expect pass 'old name in a fixture'
renamed docs/x.md 'parseConfig'; echo 'docs/** linguist-generated' >.gitattributes; git add .gitattributes; expect pass 'old name in a generated file'
renamed README.md 'parseConfig'; put src/c.ts 'export const parseConfig = 1;'; expect pass 'old name still declared elsewhere'
renamed README.md 'graph.parseConfig()'; put src/c.ts 'class Graph { parseConfig() {} }'; expect pass 'old name lives on as a method'
renamed README.md 'parseConfig'; put src/c.ts '/* parseConfig */ export const x = parseConfig;'; expect pass 'old name still used as code after a comment'
repo; put src/a.ts 'export function parseConfig() {}'; put README.md 'parseConfig'; commit; git rm -q src/a.ts; put src/b.ts 'export function parseConfig() {}'; expect pass 'declaration moved to another file'
repo; put src/a.ts 'export function parseConfig() {}'; put README.md 'parseConfig'; commit; git rm -q src/a.ts; expect block 'declaration deleted, doc still names it'
repo; put src/a.ts 'export function parse() {}'; put README.md 'parse it'; commit; put src/a.ts 'export function load() {}'; expect pass 'one-word name'
repo; put src/a.ts $'function run() {\n  const parseConfig = 1;\n}'; put README.md 'parseConfig'; commit; put src/a.ts 'function run() {}'; expect pass 'local variable removed'
repo; put src/a.ts 'const parseConfig = 1;'; put README.md 'parseConfig'; commit; put src/a.ts 'const loadConfig = 1;'; expect pass 'unexported top-level const'
renamed README.md $'```ts\nfunction parseConfig() {}\n```'; expect pass 'doc that declares the name in its own example'
repo; put src/a.ts 'export const MAX_RETRIES = 3;'; put README.md 'Set MAX_RETRIES.'; commit; put src/a.ts 'export const RETRY_LIMIT = 3;'; expect block 'snake-case name'
repo; put src/dates/old.ts 'export {}'; put README.md 'See src/dates/old.ts.'; commit; git mv src/dates/old.ts src/dates/new.ts; expect block 'old path left in a doc'
repo; put src/dates/old.ts 'export {}'; put README.md 'See src/dates/old.ts.'; commit; git mv src/dates/old.ts src/dates/new.ts; put README.md 'See src/dates/new.ts.'; expect pass 'doc path updated'
repo; put src/dates/old.ts 'export {}'; put README.md 'See lib/src/dates/old.ts.'; commit; git mv src/dates/old.ts src/dates/new.ts; expect pass 'longer path that only ends the same'
repo; put old.ts 'export {}'; put README.md 'old.ts'; commit; git mv old.ts new.ts; expect pass 'root-level file rename'
repo; put 'src/my dir/old.ts' 'export {}'; put README.md 'src/my dir/old.ts'; commit; git mv 'src/my dir/old.ts' 'src/my dir/new.ts'; expect block 'path with a space'
repo; put src/a.ts 'export function parseConfig() {}'; put README.md 'parseConfig'; commit; put src/a.ts 'export function parseConfig(x) { return x; }'; expect pass 'declaration edited in place'

finish
