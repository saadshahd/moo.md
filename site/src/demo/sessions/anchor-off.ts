import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "Finding from Tuesday's outage: migration 0042 ran CREATE INDEX on payments without CONCURRENTLY, and writes to payments blocked for 9 minutes during the deploy. Turn it into a rule for the team that covers every table, not only payments, except a table created in the same migration.",
    tools: "Edited 1 file +62, called 5 tools, ran 11 shell commands",
    activity: [
      {"at": 1.6, "line": "Running git ls-files && cat package.json && ls .codegraph…", "tool": "$ git ls-files && cat package.json && ls .codegraph 2>/dev/null; for f in $(git ls-files | grep -v -E 'package-lock|node_modules'); do echo \"=== $f\"; cat \"$f\"; done | head -400"},
      {"at": 19.6, "line": "Running npm view squawk-cli version **2**>&**1** | tail -**3**; npm r…", "tool": "$ npm view squawk-cli version 2>&1 | tail -3; npm run sql -- \"select version()\" 2>&1 | tail -2; npm run sql -- \"select * from schema_migrations\" 2>&1 | tail -5"},
      {"at": 22.6, "line": "Running npm view squawk-cli version **2**>&**1** | tail -**3**; npm r…", "tool": "$ npm_config_cache=$TMPDIR/npmc npm view squawk-cli version 2>&1 | tail -3"},
      {"at": 23.6, "line": "Running npm view squawk-cli version **2**>&**1** | tail -**3**; npm r…", "tool": "$ npm_config_cache=$TMPDIR/npmc npm view squawk-cli version 2>&1 | tail -3; ls node_modules | head -50"},
      {"at": 26.6, "line": "Running npm run sql -- \"CREATE TABLE t_probe(a int); CREA…", "tool": "$ npm run sql -- \"CREATE TABLE t_probe(a int); CREATE INDEX CONCURRENTLY t_probe_a ON t_probe(a);\" 2>&1 | tail -1; npm run sql -- \"CREATE TABLE t_probe(a int);\" 2>&1|tail -1; npm run sql -- \"-- no-transaction\nCREATE INDEX CONCURRENTLY t_probe_a ON t_probe(a);\" 2>&1|tail -1; npm run sql -- \"DROP TABLE t_probe\" 2>&1|tail -1"},
      {"at": 31.6, "line": "Running npm run sql -- \"CREATE TABLE t_probe(a int); CREA…", "tool": "$ cd $TMPDIR && mkdir -p sq && cd sq && npm_config_cache=$TMPDIR/npmc npm init -y >/dev/null && npm_config_cache=$TMPDIR/npmc npm i squawk-cli 2>&1 | tail -5; ls node_modules/.bin; printf 'CREATE INDEX payments_status_idx ON payments (status);\\n' > a.sql; printf 'CREATE TABLE x(a int);\\nCREATE INDEX x_a ON x(a);\\n' > b.sql; npx squawk a.sql b.sql 2>&1 | tail -30"},
      {"at": 37.6, "line": "Running cd $TMPDIR/sq && npx squawk --help **2**>&**1** | head -**6**…", "tool": "$ cd $TMPDIR/sq && npx squawk --help 2>&1 | head -60; printf -- '-- no-transaction\\nCREATE INDEX CONCURRENTLY p ON payments (status);\\n' > c.sql; printf 'CREATE INDEX CONCURRENTLY p ON payments (status);\\n' > d.sql; for f in a b c d; do echo \"== $f\"; npx squawk --assume-in-transaction --include require-concurrent-index-creation,ban-concurrent-index-creation-in-transaction $f.sql 2>&1 | grep -E 'warning|error|Found|issues'; done"},
      {"at": 44.6, "line": "Running cd $TMPDIR/sq && printf 'BEGIN;\\\\nCREATE INDEX CON…", "tool": "$ cd $TMPDIR/sq && printf 'BEGIN;\\nCREATE INDEX CONCURRENTLY p ON payments (status);\\nCOMMIT;\\n' > e.sql; npx squawk e.sql 2>&1 | grep -E 'warning|error'; npx squawk --assume-in-transaction d.sql 2>&1 | grep -E 'warning|error'; npx squawk a.sql >/dev/null 2>&1; echo exit=$?; ls node_modules; cat node_modules/squawk-cli/package.json | head -30"},
      {"at": 100.6, "line": "Running git log --format='%h %ad %s' --date=iso; cd $TMPD…", "tool": "$ git log --format='%h %ad %s' --date=iso; cd $TMPDIR/sq && printf 'CREATE UNIQUE INDEX u ON payments (id);\\n' > f.sql; printf 'CREATE TABLE x(a int);\\nCREATE INDEX CONCURRENTLY x_a ON x(a);\\n' > g.sql; for f in a b c d e f g; do echo \"== $f\"; npx squawk --reporter json --assume-in-transaction $f.sql 2>/dev/null | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>console.log(JSON.parse(s).map(x=>x.rule_name).join(\" \")))'; done; npx squawk --reporter json a.sql | head -c 600"},
      {"at": 118.6, "line": "Running cd $TMPDIR/sq && for f in a b d f; do echo \"== $f…", "tool": "$ cd $TMPDIR/sq && for f in a b d f; do echo \"== $f\"; (printf 'BEGIN;\\n'; cat $f.sql; printf '\\nCOMMIT;') | npx squawk --reporter json --assume-in-transaction --stdin-filepath $f.sql 2>/dev/null | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>console.log(JSON.parse(s).map(x=>x.rule_name).join(\" \")))'; done; printf 'begin;\\ncreate table x(a int);\\ncommit;\\ncreate index x_a on x(a);\\n' | npx squawk --reporter json --assume-in-transaction 2>/dev/null | grep -o '\"rule_name\":\"[a-z-]*\"'"},
      {"at": 164.6, "line": "Migration 0043 (CREATE INDEX payments_created_at_idx ON payments, committed Oct 30) has the same bug as 0042: no CONCURRENTLY on the 40M-row payments table. Has 0043 already been applied in production?", "tool": "$ cd $TMPDIR/sq && for f in a b d f; do echo \"== $f\"; (printf 'BEGIN;\\n'; cat $f.sql; printf '\\nCOMMIT;') | npx squawk --reporter json --assume-in-transaction --stdin-filepath $f.sql 2>/dev/null | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>console.log(JSON.parse(s).map(x=>x.rule_name).join(\" \")))'; done; printf 'begin;\\ncreate table x(a int);\\ncommit;\\ncreate index x_a on x(a);\\n' | npx squawk --reporter json --assume-in-transaction 2>/dev/null | grep -o '\"rule_name\":\"[a-z-]*\"'"},
      {"at": 171.6, "line": "Running npm_config_cache=$TMPDIR/npmc npm i -D -E squawk-…", "tool": "$ npm_config_cache=$TMPDIR/npmc npm i -D -E squawk-cli@2.70.0 2>&1 | tail -3; cat package.json; git diff --stat"},
      {"at": 171.6, "line": "Running npm_config_cache=$TMPDIR/npmc npm i -D -E squawk-…", "tool": "$ cd $TMPDIR/sq && for f in a b d f; do echo \"== $f\"; (printf 'BEGIN;\\n'; cat $f.sql; printf '\\nCOMMIT;') | npx squawk --reporter json --assume-in-transaction --stdin-filepath $f.sql 2>/dev/null | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>console.log(JSON.parse(s).map(x=>x.rule_name).join(\" \")))'; done; printf 'begin;\\ncreate table x(a int);\\ncommit;\\ncreate index x_a on x(a);\\n' | npx squawk --reporter json --assume-in-transaction 2>/dev/null | grep -o '\"rule_name\":\"[a-z-]*\"'"},
      {"at": 189.6, "line": "Writing test/migration-locks.test.js", "tool": "$ cd $TMPDIR/sq && for f in a b d f; do echo \"== $f\"; (printf 'BEGIN;\\n'; cat $f.sql; printf '\\nCOMMIT;') | npx squawk --reporter json --assume-in-transaction --stdin-filepath $f.sql 2>/dev/null | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>console.log(JSON.parse(s).map(x=>x.rule_name).join(\" \")))'; done; printf 'begin;\\ncreate table x(a int);\\ncommit;\\ncreate index x_a on x(a);\\n' | npx squawk --reporter json --assume-in-transaction 2>/dev/null | grep -o '\"rule_name\":\"[a-z-]*\"'"},
      {"at": 196.6, "line": "Running python**3** - <<'EOF' p='test/migration-locks.test.js' …", "tool": "$ python3 - <<'EOF'\np='test/migration-locks.test.js'\ns=open(p).read()\ns=s.replace('import { mkdtempSync, writeFileSync, existsSync } from \"node:fs\";','import { mkdtempSync, writeFileSync } from \"node:fs\";')\ns=s.replace('''function lint(files) {\n  const dir = mkdtempSync(`${tmpdir()}/mig-`);\n  for (const [name, sql] of Object.entries(files)) writeFileSync(`${dir}/${name}`, sql);\n  return plan(dir, new Set()).map(violations);\n}''','''function lint(sql) {\n  const dir = mkdtempSync(`${tmpdir()}/mig-`);\n  writeFileSync(`${dir}/0001_x.sql`, sql);\n  return violations(plan(dir, new Set())[0]);\n}''')\ns=s.replace('lint({ \"0001_x.sql\": sql })[0]','lint(sql)')\ns=s.replace('''\ntest(\"squawk is installed\", () => assert.ok(existsSync(\"node_modules/.bin/squawk\"), \"run npm ci\"));\n''','')\nopen(p,'w').write(s)\nEOF\nnpm test 2>&1 | tail -25"},
      {"at": 196.6, "line": "Running python**3** - <<'EOF' p='test/migration-locks.test.js' …", "tool": "$ cd $TMPDIR/sq && for f in a b d f; do echo \"== $f\"; (printf 'BEGIN;\\n'; cat $f.sql; printf '\\nCOMMIT;') | npx squawk --reporter json --assume-in-transaction --stdin-filepath $f.sql 2>/dev/null | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>console.log(JSON.parse(s).map(x=>x.rule_name).join(\" \")))'; done; printf 'begin;\\ncreate table x(a int);\\ncommit;\\ncreate index x_a on x(a);\\n' | npx squawk --reporter json --assume-in-transaction 2>/dev/null | grep -o '\"rule_name\":\"[a-z-]*\"'"},
      {"at": 202.6, "line": "Running git stash push db/migrations/**0043**_index_payments_…", "tool": "$ git stash push db/migrations/0043_index_payments_created_at.sql -q && npm test 2>&1 | grep -E \"^not ok|file:|rules|# (pass|fail)\" | head; git stash pop -q && git diff --stat\nnpm run sql -- \"CREATE DATABASE mig_probe\" | tail -1\nPGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres PGPASSWORD=password PGDATABASE=mig_probe node -e '\nconst {default:pg}=await import(\"pg\");const c=new pg.Client();await c.connect();await c.query(\"CREATE TABLE schema_migrations(name text primary key)\");await c.end();' --input-type=module\nPGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres PGPASSWORD=password PGDATABASE=mig_probe npm run migrate 2>&1 | tail -6\nPGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres PGPASSWORD=password PGDATABASE=mig_probe node --input-type=module -e '\nconst {default:pg}=await import(\"pg\");const c=new pg.Client();await c.connect();console.log((await c.query(\"select indexrelid::regclass::text idx, indisvalid from pg_index where indrelid=$1::regclass\",[\"payments\"])).rows);await c.end();'\nnpm run sql -- \"DROP DATABASE mig_probe\" | tail -1"},
      {"at": 210.6, "line": "Running sed -i '' 's/ - run: npm test/ - run: n…", "tool": "$ sed -i '' 's/      - run: npm test/      - run: npm ci\\n      - run: npm test/' .github/workflows/ci.yml && cat .github/workflows/ci.yml | tail -3 && cat >> README.md <<'EOF'\n\n## Migrations\n\n**Never block writes while building an index.** `CREATE INDEX` without\n`CONCURRENTLY` blocks every write to the table until the build finishes. On\n`payments` that took 9 minutes in migration 0042. The rule covers every table.\n\n- On a table that already exists, use `CREATE INDEX CONCURRENTLY`, alone in a\n  file whose first line is `-- no-transaction`. Postgres refuses\n  `CONCURRENTLY` inside a transaction, and the runner wraps every other file\n  in one. A file that sends several statements at once also counts as a\n  transaction.\n- On a table created in the same migration, a plain `CREATE INDEX` is fine\n  because nothing writes to the table yet.\n- If a concurrent build fails, it leaves an `INVALID` index behind.\n  `DROP INDEX CONCURRENTLY` it, then rerun the migration. Don't add\n  `IF NOT EXISTS`: it would silently keep the broken index.\n\n`npm test` enforces this with [squawk](https://squawkhq.com)\n(`test/migration-locks.test.js`). It lints each file the way\n`npm run migrate` runs it. Migrations 0040 and 0042 shipped before the rule\nand are exempt. Don't add to that list.\nEOF\nnpm test 2>&1 | grep -E \"^# (pass|fail)\"; git status --short"},
      {"at": 211.6, "line": "Running sed -i '' 's/ - run: npm test/ - run: n…", "tool": "$ git stash push db/migrations/0043_index_payments_created_at.sql -q && npm test 2>&1 | grep -E \"^not ok|file:|rules|# (pass|fail)\" | head; git stash pop -q && git diff --stat\nnpm run sql -- \"CREATE DATABASE mig_probe\" | tail -1\nPGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres PGPASSWORD=password PGDATABASE=mig_probe node -e '\nconst {default:pg}=await import(\"pg\");const c=new pg.Client();await c.connect();await c.query(\"CREATE TABLE schema_migrations(name text primary key)\");await c.end();' --input-type=module\nPGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres PGPASSWORD=password PGDATABASE=mig_probe npm run migrate 2>&1 | tail -6\nPGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres PGPASSWORD=password PGDATABASE=mig_probe node --input-type=module -e '\nconst {default:pg}=await import(\"pg\");const c=new pg.Client();await c.connect();console.log((await c.query(\"select indexrelid::regclass::text idx, indisvalid from pg_index where indrelid=$1::regclass\",[\"payments\"])).rows);await c.end();'\nnpm run sql -- \"DROP DATABASE mig_probe\" | tail -1"},
    ],
    dialogs: [
      {
        "at": [
          127.0,
          164.2
        ],
        "after": 10,
        "tool": "$ cd $TMPDIR/sq && for f in a b d f; do echo \"== $f\"; (printf 'BEGIN;\\n'; cat $f.sql; printf '\\nCOMMIT;') | npx squawk --reporter json --assume-in-transaction --stdin-filepath $f.sql 2>/dev/null | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>console.log(JSON.parse(s).map(x=>x.rule_name).join(\" \")))'; done; printf 'begin;\\ncreate table x(a int);\\ncommit;\\ncreate index x_a on x(a);\\n' | npx squawk --reporter json --assume-in-transaction 2>/dev/null | grep -o '\"rule_name\":\"[a-z-]*\"'",
        "questions": [
          {
            "header": "0043 status",
            "question": "Migration 0043 (CREATE INDEX payments_created_at_idx ON payments, committed Oct 30) has the same bug as 0042: no CONCURRENTLY on the 40M-row payments table. Has 0043 already been applied in production?",
            "multiSelect": false,
            "options": [
              {
                "label": "Not deployed yet — fix it",
                "description": "Rewrite 0043 as a `-- no-transaction` CREATE INDEX CONCURRENTLY so the next deploy doesn't block writes again."
              },
              {
                "label": "Already applied — exempt it",
                "description": "Add 0043 to the exempt list with 0040 and 0042. Editing it would change nothing, since the runner skips files it has already applied."
              },
              {
                "label": "Not sure",
                "description": "Leave 0043 out of the exempt list so the new check fails CI until someone confirms. npm test will stay red until then."
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 222.5,
    chrome: [
      [-9.4, {"context": "0%"}],
      [-0.4, {"context": "0%", "spin": {"verb": "Schlepping"}}],
      [0.6, {"context": "0%", "spin": {"verb": "Unfurling", "tail": ""}}],
      [1.6, {"context": "4% · 35.4k", "spin": {"verb": "Unfurling", "tail": "↓ 132 tokens"}}],
      [1.6, {"context": "4% · 35.4k", "spin": {"verb": "Unfurling", "tail": "↓ 209 tokens"}}],
      [2.6, {"context": "4% · 35.4k", "spin": {"verb": "Unfurling", "tail": "↓ 219 tokens"}}],
      [3.6, {"context": "4% · 35.4k", "spin": {"verb": "Unfurling", "tail": "↓ 223 tokens"}}],
      [19.6, {"context": "4% · 38.8k", "spin": {"verb": "Unfurling", "tail": "↓ 1.6k tokens"}}],
      [21.6, {"context": "4% · 38.8k", "spin": {"verb": "Unfurling", "tail": "↓ 1.7k tokens"}}],
      [21.6, {"context": "4% · 38.8k", "spin": {"verb": "Unfurling", "tail": "↓ 1.8k tokens"}}],
      [22.6, {"context": "4% · 40.5k", "spin": {"verb": "Unfurling", "tail": "↓ 1.8k tokens"}}],
      [23.6, {"context": "4% · 40.5k", "spin": {"verb": "Unfurling", "tail": "↓ 1.9k tokens"}}],
      [24.6, {"context": "4% · 40.8k", "spin": {"verb": "Unfurling", "tail": "↓ 2.0k tokens"}}],
      [25.6, {"context": "4% · 40.8k", "spin": {"verb": "Unfurling", "tail": "↓ 2.1k tokens"}}],
      [26.6, {"context": "4% · 41k", "spin": {"verb": "Unfurling", "tail": "↓ 2.2k tokens"}}],
      [26.6, {"context": "4% · 41k", "spin": {"verb": "Unfurling", "tail": "↓ 2.3k tokens"}}],
      [29.6, {"context": "4% · 41k", "spin": {"verb": "Unfurling", "tail": "↓ 2.4k tokens"}}],
      [29.6, {"context": "4% · 41.4k", "spin": {"verb": "Unfurling", "tail": "↓ 2.5k tokens"}}],
      [30.6, {"context": "4% · 41.4k", "spin": {"verb": "Unfurling", "tail": "↓ 2.6k tokens"}}],
      [32.6, {"context": "4% · 41.4k", "spin": {"verb": "Unfurling", "tail": "↓ 2.7k tokens"}}],
      [35.6, {"context": "4% · 42.7k", "spin": {"verb": "Unfurling", "tail": "↓ 2.8k tokens"}}],
      [36.6, {"context": "4% · 42.7k", "spin": {"verb": "Unfurling", "tail": "↓ 2.9k tokens"}}],
      [37.6, {"context": "4% · 42.7k", "spin": {"verb": "Unfurling", "tail": "↓ 3.1k tokens"}}],
      [38.6, {"context": "4% · 42.7k", "spin": {"verb": "Unfurling", "tail": "↓ 3.2k tokens"}}],
      [42.6, {"context": "4% · 45k", "spin": {"verb": "Unfurling", "tail": "↓ 3.3k tokens"}}],
      [43.6, {"context": "4% · 45k", "spin": {"verb": "Unfurling", "tail": "↓ 3.4k tokens"}}],
      [44.6, {"context": "4% · 45k", "spin": {"verb": "Unfurling", "tail": "↓ 3.6k tokens"}}],
      [44.6, {"context": "4% · 45k", "spin": {"verb": "Unfurling", "tail": "↓ 3.7k tokens"}}],
      [48.6, {"context": "4% · 45k", "spin": {"verb": "Unfurling", "tail": "↓ 3.8k tokens"}}],
      [49.6, {"context": "5% · 46.6k", "spin": {"verb": "Unfurling", "tail": "↓ 4.0k tokens"}}],
      [49.6, {"context": "5% · 46.6k", "spin": {"verb": "Unfurling", "tail": "↓ 4.1k tokens"}}],
      [100.6, {"context": "5% · 46.6k", "spin": {"verb": "Unfurling", "tail": "↓ 4.2k tokens"}}],
      [101.6, {"context": "5% · 48k", "spin": {"verb": "Unfurling", "tail": "↓ 4.2k tokens"}}],
      [102.6, {"context": "5% · 48k", "spin": {"verb": "Unfurling", "tail": "↓ 4.3k tokens"}}],
      [103.6, {"context": "5% · 48k", "spin": {"verb": "Unfurling", "tail": "↓ 4.4k tokens"}}],
      [115.6, {"context": "5% · 48k", "spin": {"verb": "Unfurling", "tail": "↓ 5.4k tokens"}}],
      [115.6, {"context": "5% · 49.1k", "spin": {"verb": "Unfurling", "tail": "↓ 5.4k tokens"}}],
      [117.6, {"context": "5% · 49.1k", "spin": {"verb": "Unfurling", "tail": "↓ 5.5k tokens"}}],
      [118.6, {"context": "5% · 49.1k", "spin": {"verb": "Unfurling", "tail": "↓ 5.6k tokens"}}],
      [119.6, {"context": "5% · 49.1k", "spin": {"verb": "Unfurling", "tail": "↓ 5.8k tokens"}}],
      [123.6, {"context": "5% · 50.8k", "spin": {"verb": "Unfurling", "tail": "↓ 5.9k tokens"}}],
      [124.6, {"context": "5% · 50.8k", "spin": {"verb": "Unfurling", "tail": "↓ 6.1k tokens"}}],
      [125.6, {"context": "5% · 50.8k", "spin": {"verb": "Unfurling", "tail": "↓ 6.3k tokens"}}],
      [126.6, {"context": "5% · 50.8k", "spin": {"verb": "Unfurling", "tail": "↓ 6.4k tokens"}}],
      [163.6, {"context": "5% · 50.8k", "spin": {"verb": "Unfurling", "tail": "↓ 6.5k tokens"}}],
      [170.6, {"context": "5% · 51.7k", "spin": {"verb": "Unfurling", "tail": "↓ 7.0k tokens"}}],
      [171.6, {"context": "5% · 51.7k", "spin": {"verb": "Unfurling", "tail": "↓ 7.1k tokens"}}],
      [173.6, {"context": "5% · 51.7k", "spin": {"verb": "Unfurling", "tail": "↓ 7.2k tokens"}}],
      [174.6, {"context": "5% · 52.6k", "spin": {"verb": "Unfurling", "tail": "↓ 7.4k tokens"}}],
      [174.6, {"context": "5% · 52.6k", "spin": {"verb": "Unfurling", "tail": "↓ 7.5k tokens"}}],
      [179.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 7.7k tokens"}}],
      [179.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 7.8k tokens"}}],
      [180.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 8.0k tokens"}}],
      [181.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 8.1k tokens"}}],
      [182.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 8.2k tokens"}}],
      [184.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 8.3k tokens"}}],
      [185.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 8.4k tokens"}}],
      [186.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 8.5k tokens"}}],
      [187.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 8.6k tokens"}}],
      [189.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 8.7k tokens"}}],
      [189.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 8.8k tokens"}}],
      [190.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 9.0k tokens"}}],
      [191.6, {"context": "5% · 54.1k", "spin": {"verb": "Unfurling", "tail": "↓ 9.2k tokens"}}],
      [193.6, {"context": "6% · 55.8k", "spin": {"verb": "Unfurling", "tail": "↓ 9.4k tokens"}}],
      [194.6, {"context": "6% · 55.8k", "spin": {"verb": "Unfurling", "tail": "↓ 9.5k tokens"}}],
      [194.6, {"context": "6% · 55.8k", "spin": {"verb": "Unfurling", "tail": "↓ 9.6k tokens"}}],
      [195.6, {"context": "6% · 55.8k", "spin": {"verb": "Unfurling", "tail": "↓ 9.7k tokens"}}],
      [196.6, {"context": "6% · 55.8k", "spin": {"verb": "Unfurling", "tail": "↓ 9.8k tokens"}}],
      [198.6, {"context": "6% · 55.8k", "spin": {"verb": "Unfurling", "tail": "↓ 9.9k tokens"}}],
      [199.6, {"context": "6% · 57.9k", "spin": {"verb": "Unfurling", "tail": "↓ 10.0k tokens"}}],
      [199.6, {"context": "6% · 57.9k", "spin": {"verb": "Unfurling", "tail": "↓ 10.2k tokens"}}],
      [201.6, {"context": "6% · 57.9k", "spin": {"verb": "Unfurling", "tail": "↓ 10.3k tokens"}}],
      [202.6, {"context": "6% · 57.9k", "spin": {"verb": "Unfurling", "tail": "↓ 10.4k tokens"}}],
      [204.6, {"context": "6% · 57.9k", "spin": {"verb": "Unfurling", "tail": "↓ 10.5k tokens"}}],
      [206.6, {"context": "6% · 59k", "spin": {"verb": "Unfurling", "tail": "↓ 10.5k tokens"}}],
      [207.6, {"context": "6% · 59k", "spin": {"verb": "Unfurling", "tail": "↓ 10.6k tokens"}}],
      [208.6, {"context": "6% · 59k", "spin": {"verb": "Unfurling", "tail": "↓ 10.7k tokens"}}],
      [209.6, {"context": "6% · 59k", "spin": {"verb": "Unfurling", "tail": "↓ 10.8k tokens"}}],
      [211.6, {"context": "6% · 59k", "spin": {"verb": "Unfurling", "tail": "↓ 11.0k tokens"}}],
      [212.6, {"context": "6% · 59k", "spin": {"verb": "Unfurling", "tail": "↓ 11.1k tokens"}}],
      [219.6, {"context": "6% · 59k", "spin": {"verb": "Unfurling", "tail": "↓ 11.2k tokens"}}],
      [219.6, {"context": "6% · 59.7k", "spin": {"verb": "Unfurling", "tail": "↓ 11.9k tokens"}}],
      [221.6, {"context": "6% · 59.7k", "spin": {"verb": "Unfurling", "tail": "↓ 12.0k tokens"}}],
      [222.6, {"context": "6% · 59.7k"}],
    ],
    reply: [
      "The rule is now a test that fails CI. I also fixed 0043, as you asked. Nothing is committed yet.",
      "",
      "**The rule (added to README under \"Migrations\"):** Never block writes while building an index, on any table.",
      "- **Existing table:** use `CREATE INDEX CONCURRENTLY`, as the only statement in a file whose first line is `-- no-transaction`. Postgres refuses `CONCURRENTLY` inside a transaction. The runner wraps every other file in one, and several statements sent at once also count as a transaction. I confirmed both against the local Postgres.",
      "- **Table created in the same migration:** a plain `CREATE INDEX` is fine, because nothing writes to it yet.",
      "- **If a concurrent build fails:** it leaves an `INVALID` index behind. Drop that index and rerun the migration. Don't add `IF NOT EXISTS`, because it would quietly keep the broken index.",
      "",
      "**How it's enforced:** `test/migration-locks.test.js` runs on `npm test`, which CI already runs.",
      "- It uses **squawk**, an existing Postgres migration linter (pinned devDependency `squawk-cli@2.70.0`), rather than custom SQL parsing. squawk already handles the same-migration exemption.",
      "- It lints each file exactly as `scripts/migrate.js` will send it to the database, so the transaction check follows the runner's real behaviour.",
      "- It only fails on squawk's two index-locking rules. squawk's other default rules (timeouts, bigint and others) would flag every existing file, so the test ignores them.",
      "- Six example cases pin the rule down: plain index and unique index (flagged), concurrent index alone with the header (passes), concurrent index without the header (flagged), concurrent index sharing a file (flagged), and the same-migration exemption (passes).",
      "- 0040 and 0042 are already applied, so they're on an exempt list. A second test fails if a listed file goes missing or stops breaking the rule, so the list can't quietly go stale.",
      "",
      "**Other changes:**",
      "- **0043** is now `-- no-transaction` + `CREATE INDEX CONCURRENTLY payments_created_at_idx ON payments (created_at);`. As it was, the next deploy would have repeated Tuesday's outage.",
      "- **CI:** I added `npm ci` before `npm test`. The workflow never installed dependencies, so squawk wouldn't exist in CI and the check would always fail there.",
      "",
      "**Checks run:**",
      "- `npm test`: 5/5 pass.",
      "- With the old 0043 put back, the new test fails and names 0043.",
      "- Running `npm run migrate` on an empty scratch database applied 0039–0043, and `payments_created_at_idx` came out valid. I dropped the scratch database afterwards.",
      "- I haven't run `npm ci` locally, because it would wipe `node_modules` while the local Postgres is running from it. The lockfile was generated by `npm i` and includes squawk's Linux build, so CI should install it cleanly.",
      "",
      "The rule only covers creating indexes. `DROP INDEX` without `CONCURRENTLY` and some `ALTER TABLE` forms also block writes. squawk has rules for those, and I can add them to the same test if you want.",
    ],
    keys: [
      [
        -3.2,
        "type",
        "Finding from Tuesday's outage: migration 0042 ran CREATE INDEX on payments without CONCURRENTLY, and writes to payments blocked for 9 minutes during the deploy. Turn it into a rule for the team that covers every table, not only payments,"
      ],
      [
        -1.9,
        "type",
        " except a table created in the same migration."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ],
      [
        164.2,
        "key",
        "Enter"
      ]
    ],
  },
];
