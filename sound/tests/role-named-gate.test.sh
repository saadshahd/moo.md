#!/usr/bin/env bash
# Runs the role-name gate against throwaway repos, one case per behaviour it must keep.
set -euo pipefail
gate=$(cd "$(dirname "$0")/../corpus/naming" && pwd)/no-role-named-modules.gate
source "$(dirname "$0")/gate-lib.sh"

add() { mkdir -p "$(dirname "$1")"; echo "${2:-export {}}" >"$1"; git add "$1"; }
commit() { git commit -qm c; }

for role in shared utils helpers common lib; do
  repo; add "src/$role/a.ts"; expect block "new file under $role/"
done
repo; add src/utils/a.ts; grep -q 'src/utils/a.ts  (utils)' <(/bin/bash "$gate" 2>&1 || true) && echo 'ok   message names file and role' || { echo 'FAIL message'; fails=$((fails + 1)); }
repo; add src/utils.ts; expect block 'new module named utils'
repo; add utils/a.js; expect block 'new file under a root-level role folder'
repo; add src/deep/helpers/a.tsx; expect block 'role folder nested deep'
repo; add src/dates/a.ts; expect pass 'domain-named folder'
repo; add src/utilities/a.ts; expect pass 'folder that only starts with a role word'
repo; add src/libs/a.ts; expect pass 'plural of a role word'
repo; add src/utils/data.json; expect pass 'non-source file under a role folder'
repo; add src/utils/a.ts; commit; echo 'export const a = 1;' >src/utils/a.ts; git add src/utils/a.ts; expect pass 'existing file edited in place'
repo; add src/utils/a.ts; commit; git mv src/utils/a.ts src/utils/b.ts; expect pass 'file renamed inside the role folder'
repo; add src/dates/a.ts; commit; mkdir -p src/utils; git mv src/dates/a.ts src/utils/a.ts; expect block 'file moved into a role folder'
repo; add src/utils/a.ts; commit; mkdir -p src/dates; git mv src/utils/a.ts src/dates/a.ts; expect pass 'file moved out of a role folder'
repo; add src/utils/a.ts; commit; cp src/utils/a.ts src/utils/b.ts; git add src/utils/b.ts; expect block 'file copied inside the role folder'
repo; add node_modules/x/utils/a.js; git add -f node_modules; expect pass 'vendored path'
repo; add test/fixtures/utils/a.ts; expect pass 'test fixture path'
repo; add hope/slop.evals/cases/helpers.ts; expect pass 'eval specimen path'
repo; add vendor-copy/shared/a.ts; echo 'vendor-copy/** linguist-vendored' >.gitattributes; git add .gitattributes; expect pass 'path marked linguist-vendored'
repo; add gen/utils/a.ts; echo 'gen/** linguist-generated' >.gitattributes; git add .gitattributes; expect pass 'path marked linguist-generated'
repo; add gen/utils/a.ts; echo 'other/** linguist-generated' >.gitattributes; git add .gitattributes; expect block 'attribute on another path'
repo; add packages/utils/package.json '{"name":"@a/utils"}'; add packages/utils/src/a.ts; expect pass 'published package named for the role'
repo; add packages/utils/package.json '{"name":"@a/utils","private":true}'; add packages/utils/src/a.ts; expect block 'private package named for the role'
repo; add packages/app/package.json '{"name":"@a/app"}'; add packages/app/src/utils/a.ts; expect block 'role folder inside a published package'
repo; add package.json '{"name":"root"}'; add src/utils/a.ts; expect block 'root package does not exempt'
repo; add 'src/utils/sp ace.ts'; expect block 'path with a space'

finish
