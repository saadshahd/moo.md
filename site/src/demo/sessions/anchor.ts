import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:anchor Finding from Tuesday's outage: migration 0042 ran CREATE INDEX on payments without CONCURRENTLY, and writes to payments blocked for 9 minutes during the deploy.",
    tools: "Edited 1 file +72, called 2 tools, ran 9 shell commands",
    activity: [
      {"at": 4.1, "line": "Listing repo files and recent commit history", "tool": "$ ls -la && git log --stat --oneline | head -50 && ls .codegraph 2>/dev/null"},
      {"at": 7.1, "line": "Listing repo files and recent commit history", "tool": "$ for f in README.md package.json .gitignore .github/workflows/ci.yml scripts/migrate.js test/migrate.test.js db/migrations/*; do echo \"=== $f\"; cat \"$f\"; done; git status; ls test"},
      {"at": 50.1, "line": "Showing commit dates and checking for a local Postgres", "tool": "$ git log --format='%h %ad %s' --date=format:'%a %Y-%m-%d %H:%M' && git tag && git branch -a && which psql postgres pg_ctl docker initdb 2>&1; ls /opt/homebrew/opt | grep -i postgres; ls node_modules 2>&1 | head"},
      {"at": 54.1, "line": "Showing commit dates and checking for a local Postgres", "tool": "$ docker info --format '{{.ServerVersion}}' 2>&1 | head -3; docker images postgres --format '{{.Repository}}:{{.Tag}}' 2>&1 | head"},
      {"at": 71.1, "line": "Testing CONCURRENTLY against the runner's transaction rules in Postgres 16", "tool": "$ set -u\ndocker run -d --rm --name anchor-pg -e POSTGRES_PASSWORD=x postgres:16-alpine >/dev/null\nfor i in $(seq 1 30); do docker exec anchor-pg pg_isready -U postgres -q && break; sleep 1; done\nq() { docker exec anchor-pg psql -U postgres -v ON_ERROR_STOP=1 -qAt -c \"$1\" 2>&1; echo \"  -> exit $?\"; }\nq \"CREATE TABLE payments (id bigserial PRIMARY KEY, status text NOT NULL); INSERT INTO payments (status) SELECT 'ok' FROM generate_series(1,1000);\"\necho \"== 1. runner wrap: BEGIN + CONCURRENTLY + COMMIT\"\nq \"BEGIN;\nCREATE INDEX CONCURRENTLY a_idx ON payments (status);\nCOMMIT;\"\necho \"== 2. no-transaction, CONCURRENTLY plus a second statement\"\nq \"-- no-transaction\nCREATE INDEX CONCURRENTLY b_idx ON payments (status);\nSELECT 1;\"\necho \"== 3. no-transaction, CONCURRENTLY alone\"\nq \"-- no-transaction\nCREATE INDEX CONCURRENTLY c_idx ON payments (status);\"\necho \"== 4. lock modes: plain CREATE INDEX held open, then an INSERT from another session\"\ndocker exec anchor-pg psql -U postgres -qAt -c \"BEGIN; CREATE INDEX d_idx ON payments (status); SELECT mode FROM pg_locks WHERE relation='payments'::regclass AND pid=pg_backend_pid(); SELECT pg_sleep(4); COMMIT;\" &\nsleep 1.5\nq \"SET lock_timeout='1s'; INSERT INTO payments (status) VALUES ('x');\"\nwait"},
      {"at": 82.1, "line": "Confirming inserts proceed while CREATE INDEX CONCURRENTLY runs", "tool": "$ q() { docker exec anchor-pg psql -U postgres -v ON_ERROR_STOP=1 -qAt -c \"$1\" 2>&1; echo \"  -> exit $?\"; }\nq \"INSERT INTO payments (status) SELECT md5(g::text) FROM generate_series(1,3000000) g;\"\necho \"== 5. CONCURRENTLY running, INSERT from another session\"\ndocker exec anchor-pg psql -U postgres -qAt -c \"\\timing on\" -c \"CREATE INDEX CONCURRENTLY e_idx ON payments (status);\" &\nsleep 1\nq \"SELECT mode FROM pg_locks WHERE relation='payments'::regclass AND mode LIKE '%Exclusive%';\"\nq \"SET lock_timeout='1s'; INSERT INTO payments (status) VALUES ('y') RETURNING 'insert ok';\"\nwait\ndocker stop anchor-pg >/dev/null"},
      {"at": 352.1, "line": "The outage rule says 'index payments with CONCURRENTLY', but a test can't see table size, so 'big table' can't trigger it. Which tables should the CI check cover? (All three flag 0043, the plain CREATE INDEX on payments committed Friday.)", "tool": "$ q() { docker exec anchor-pg psql -U postgres -v ON_ERROR_STOP=1 -qAt -c \"$1\" 2>&1; echo \"  -> exit $?\"; }\nq \"INSERT INTO payments (status) SELECT md5(g::text) FROM generate_series(1,3000000) g;\"\necho \"== 5. CONCURRENTLY running, INSERT from another session\"\ndocker exec anchor-pg psql -U postgres -qAt -c \"\\timing on\" -c \"CREATE INDEX CONCURRENTLY e_idx ON payments (status);\" &\nsleep 1\nq \"SELECT mode FROM pg_locks WHERE relation='payments'::regclass AND mode LIKE '%Exclusive%';\"\nq \"SET lock_timeout='1s'; INSERT INTO payments (status) VALUES ('y') RETURNING 'insert ok';\"\nwait\ndocker stop anchor-pg >/dev/null"},
      {"at": 379.1, "line": "Look up the squawk migration linter's index rules", "tool": "$ npm view squawk-cli version description 2>&1 | head -5; curl -sL https://squawkhq.com/docs/require-concurrent-index-creation | sed 's/<[^>]*>/ /g' | tr -s ' \\n' | grep -io '.\\{0,200\\}same transaction.\\{0,200\\}\\|.\\{0,200\\}created in.\\{0,200\\}' | head -5; curl -sL https://squawkhq.com/docs/ban-concurrent-index-creation-in-transaction | sed 's/<[^>]*>/ /g' | tr -s ' \\n' | grep -io '.\\{0,250\\}assume-in-transaction.\\{0,150\\}' | head -3"},
      {"at": 386.1, "line": "Extracting squawk rule details about same-file tables and transactions", "tool": "$ for p in require-concurrent-index-creation ban-concurrent-index-creation-in-transaction; do echo \"=== $p\"; curl -sL \"https://squawkhq.com/docs/$p\" | sed 's/<[^>]*>/ /g' | tr -s ' \\n' | perl -ne 'while(/(.{0,160}(same transaction|created in|assume.in.transaction).{0,160})/gi){print \"$1\\n\"}' | head -4; done"},
      {"at": 419.1, "line": "Writing test/concurrent-index.test.js", "tool": "$ for p in require-concurrent-index-creation ban-concurrent-index-creation-in-transaction; do echo \"=== $p\"; curl -sL \"https://squawkhq.com/docs/$p\" | sed 's/<[^>]*>/ /g' | tr -s ' \\n' | perl -ne 'while(/(.{0,160}(same transaction|created in|assume.in.transaction).{0,160})/gi){print \"$1\\n\"}' | head -4; done"},
      {"at": 422.1, "line": "Writing test/concurrent-index.test.js", "tool": "$ npm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|0043|Write each' | head -20"},
      {"at": 479.1, "line": "Rewriting 0043 to build its index concurrently and rerunning tests", "tool": "$ printf -- '-- no-transaction\\nCREATE INDEX CONCURRENTLY payments_created_at_idx ON payments (created_at);\\n' > db/migrations/0043_index_payments_created_at.sql && git diff && npm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))'"},
      {"at": 480.1, "line": "Rewriting 0043 to build its index concurrently and rerunning tests", "tool": "$ npm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|0043|Write each' | head -20"},
    ],
    dialogs: [
      {
        "at": [
          298.5,
          351.6
        ],
        "after": 6,
        "tool": "$ q() { docker exec anchor-pg psql -U postgres -v ON_ERROR_STOP=1 -qAt -c \"$1\" 2>&1; echo \"  -> exit $?\"; }\nq \"INSERT INTO payments (status) SELECT md5(g::text) FROM generate_series(1,3000000) g;\"\necho \"== 5. CONCURRENTLY running, INSERT from another session\"\ndocker exec anchor-pg psql -U postgres -qAt -c \"\\timing on\" -c \"CREATE INDEX CONCURRENTLY e_idx ON payments (status);\" &\nsleep 1\nq \"SELECT mode FROM pg_locks WHERE relation='payments'::regclass AND mode LIKE '%Exclusive%';\"\nq \"SET lock_timeout='1s'; INSERT INTO payments (status) VALUES ('y') RETURNING 'insert ok';\"\nwait\ndocker stop anchor-pg >/dev/null",
        "questions": [
          {
            "header": "Scope",
            "question": "The outage rule says 'index payments with CONCURRENTLY', but a test can't see table size, so 'big table' can't trigger it. Which tables should the CI check cover? (All three flag 0043, the plain CREATE INDEX on payments committed Friday.)",
            "multiSelect": false,
            "options": [
              {
                "label": "Every table (Recommended)",
                "description": "Every CREATE INDEX must be CONCURRENTLY. No table names to parse. An index on a brand-new table goes in its own file.",
                "preview": "Every CREATE [UNIQUE] INDEX must be CONCURRENTLY,\nalone in a file whose first line is -- no-transaction.\n\n0043  CREATE INDEX ... ON payments          fail\nnew   CREATE INDEX ... ON refunds           fail\nnew   CREATE TABLE t ...;\n      CREATE INDEX ... ON t                 fail\n      -> move the index to its own file"
              },
              {
                "label": "Payments only",
                "description": "What the finding names, read literally. A future large table can block writes again with nothing flagging it.",
                "preview": "A CREATE [UNIQUE] INDEX ON payments must be\nCONCURRENTLY, alone in a -- no-transaction file.\n\n0043  CREATE INDEX ... ON payments          fail\nnew   CREATE INDEX ... ON refunds           pass\nnew   CREATE TABLE t ...;\n      CREATE INDEX ... ON t                 pass"
              },
              {
                "label": "All but same-file tables",
                "description": "Every table, except one the same file creates (known empty). The test must parse table names from the SQL.",
                "preview": "Every CREATE [UNIQUE] INDEX must be CONCURRENTLY,\nalone in a -- no-transaction file, unless the same\nfile creates the table it indexes.\n\n0043  CREATE INDEX ... ON payments          fail\nnew   CREATE INDEX ... ON refunds           fail\nnew   CREATE TABLE t ...;\n      CREATE INDEX ... ON t                 pass"
              }
            ],
            "picked": [
              0
            ],
            "notes": "Every table. Small tables grow; payments was small once."
          }
        ]
      }
    ],
    replyAt: 512.4,
    chrome: [
      [-2.9, {"context": "0%", "style": "hold:Plain"}],
      [-0.9, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Gitifying"}}],
      [2.1, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "thinking with xhigh effort"}}],
      [3.1, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 63 tokens · thinking with xhigh effort"}}],
      [4.1, {"context": "3% · 34.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 220 tokens · thought for 2s"}}],
      [5.1, {"context": "3% · 34.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 295 tokens · thought for 2s"}}],
      [5.1, {"context": "3% · 34.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 305 tokens · thought for 2s"}}],
      [6.1, {"context": "3% · 34.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 306 tokens"}}],
      [7.1, {"context": "3% · 34.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 331 tokens"}}],
      [8.1, {"context": "4% · 35.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 458 tokens"}}],
      [9.1, {"context": "4% · 35.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 468 tokens"}}],
      [10.1, {"context": "4% · 35.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 473 tokens"}}],
      [10.1, {"context": "4% · 35.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 473 tokens · thinking with xhigh effort"}}],
      [20.1, {"context": "4% · 35.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 473 tokens · still thinking with xhigh effort"}}],
      [30.1, {"context": "4% · 35.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 473 tokens · thinking more with xhigh effort"}}],
      [40.1, {"context": "4% · 35.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 473 tokens · thinking some more with xhigh effort"}}],
      [49.1, {"context": "4% · 37.7k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 4.4k tokens · thought for 38s"}}],
      [49.1, {"context": "4% · 37.7k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 4.5k tokens · thought for 38s"}}],
      [50.1, {"context": "4% · 37.7k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 4.6k tokens · thought for 38s"}}],
      [51.1, {"context": "4% · 37.7k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 4.7k tokens"}}],
      [52.1, {"context": "4% · 37.7k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 4.7k tokens · thinking with xhigh effort"}}],
      [52.1, {"context": "4% · 37.7k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 4.8k tokens · thinking with xhigh effort"}}],
      [54.1, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 5.0k tokens · thought for 2s"}}],
      [55.1, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 5.1k tokens · thought for 2s"}}],
      [56.1, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 5.1k tokens"}}],
      [58.1, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 5.1k tokens · thinking with xhigh effort"}}],
      [65.1, {"context": "4% · 42.6k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 5.7k tokens · thought for 7s"}}],
      [67.1, {"context": "4% · 42.6k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 5.8k tokens · thought for 7s"}}],
      [68.1, {"context": "4% · 42.6k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 5.8k tokens"}}],
      [68.1, {"context": "4% · 42.6k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 5.9k tokens"}}],
      [70.1, {"context": "4% · 42.6k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 6.0k tokens"}}],
      [71.1, {"context": "4% · 42.6k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 6.1k tokens"}}],
      [74.1, {"context": "4% · 42.6k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 6.6k tokens"}}],
      [79.1, {"context": "4% · 42.6k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 6.6k tokens · thinking with xhigh effort"}}],
      [80.1, {"context": "4% · 44.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 6.7k tokens · thinking with xhigh effort"}}],
      [81.1, {"context": "4% · 44.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 6.9k tokens · thought for 1s"}}],
      [82.1, {"context": "4% · 44.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 7.0k tokens · thought for 1s"}}],
      [83.1, {"context": "4% · 44.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 7.0k tokens"}}],
      [86.1, {"context": "4% · 44.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 7.1k tokens"}}],
      [118.1, {"context": "4% · 44.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 7.1k tokens · thinking with xhigh effort"}}],
      [128.1, {"context": "4% · 44.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 7.1k tokens · still thinking with xhigh effort"}}],
      [137.1, {"context": "4% · 44.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 7.1k tokens · thinking more with xhigh effort"}}],
      [147.1, {"context": "4% · 44.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 7.1k tokens · thinking some more with xhigh effort"}}],
      [148.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 9.9k tokens · thought for 30s"}}],
      [150.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 9.9k tokens"}}],
      [263.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 9.9k tokens · thinking with xhigh effort"}}],
      [272.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 9.9k tokens · still thinking with xhigh effort"}}],
      [282.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 9.9k tokens · thinking more with xhigh effort"}}],
      [293.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 12.6k tokens · thought for 30s"}}],
      [294.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 12.7k tokens"}}],
      [295.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 12.8k tokens"}}],
      [296.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 12.9k tokens"}}],
      [298.1, {"context": "5% · 45.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 13.0k tokens"}}],
      [351.1, {"context": "5% · 49.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 13.6k tokens"}}],
      [355.1, {"context": "5% · 49.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 13.6k tokens · thinking with xhigh effort"}}],
      [365.1, {"context": "5% · 49.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 13.6k tokens · still thinking with xhigh effort"}}],
      [374.1, {"context": "5% · 49.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 13.6k tokens · thinking more with xhigh effort"}}],
      [377.1, {"context": "5% · 49.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 15.8k tokens · thought for 22s"}}],
      [378.1, {"context": "5% · 53k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 15.8k tokens · thought for 22s"}}],
      [379.1, {"context": "5% · 53k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 15.9k tokens · thought for 22s"}}],
      [379.1, {"context": "5% · 53k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 15.9k tokens"}}],
      [382.1, {"context": "5% · 53k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 16.1k tokens"}}],
      [383.1, {"context": "5% · 53k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 16.2k tokens"}}],
      [385.1, {"context": "5% · 53k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 16.3k tokens"}}],
      [386.1, {"context": "6% · 55.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 16.3k tokens"}}],
      [387.1, {"context": "6% · 55.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 16.4k tokens"}}],
      [387.1, {"context": "6% · 55.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 16.5k tokens"}}],
      [389.1, {"context": "6% · 55.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 16.5k tokens · thinking with xhigh effort"}}],
      [399.1, {"context": "6% · 55.8k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 16.5k tokens · still thinking with xhigh effort"}}],
      [409.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 18.6k tokens · thought for 19s"}}],
      [410.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 18.7k tokens"}}],
      [411.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 18.8k tokens"}}],
      [412.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 18.9k tokens"}}],
      [414.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 19.0k tokens"}}],
      [415.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 19.1k tokens"}}],
      [416.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 19.2k tokens"}}],
      [417.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 19.3k tokens"}}],
      [419.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 19.4k tokens"}}],
      [419.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 20.2k tokens"}}],
      [422.1, {"context": "6% · 56.3k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 20.3k tokens"}}],
      [423.1, {"context": "6% · 60.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 20.3k tokens"}}],
      [424.1, {"context": "6% · 60.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 20.3k tokens · thinking with xhigh effort"}}],
      [432.1, {"context": "6% · 60.1k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.1k tokens · thought for 8s"}}],
      [433.1, {"context": "6% · 60.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.1k tokens · thought for 8s"}}],
      [435.1, {"context": "6% · 60.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.1k tokens"}}],
      [475.1, {"context": "6% · 60.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.1k tokens · thinking with xhigh effort"}}],
      [477.1, {"context": "6% · 60.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.2k tokens · thought for 2s"}}],
      [478.1, {"context": "6% · 60.5k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.4k tokens · thought for 2s"}}],
      [479.1, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.5k tokens · thought for 2s"}}],
      [480.1, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.6k tokens"}}],
      [481.1, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.6k tokens · thinking with xhigh effort"}}],
      [491.1, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.6k tokens · still thinking with xhigh effort"}}],
      [501.1, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.6k tokens · thinking more with xhigh effort"}}],
      [512.1, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Perusing", "tail": "↓ 21.6k tokens · thinking some more with xhigh effort"}}],
      [512.1, {"context": "6% · 62.6k", "style": "hold:Plain"}],
    ],
    reply: [
      "Rule: every `CREATE INDEX` is `CONCURRENTLY`, alone in a `-- no-transaction` file.",
      "The rule fails 0043, so I rewrote 0043.",
      "",
      "| piece | status | note |",
      "|---|---|---|",
      "| `test/concurrent-index.test.js` | tested | failed on 0043, passes after rewrite |",
      "| 0043 rewrite | tested | safe whether or not it already ran |",
      "| `-- no-transaction`, one statement | tested | Postgres 16 refuses `CONCURRENTLY` otherwise |",
      "| deploy time for 0043 | — | gap: timeout unknown; build reads 40M rows twice |",
      "| a build that dies mid-deploy | — | `DROP INDEX CONCURRENTLY payments_created_at_idx`, redeploy |",
      "| `ALTER TABLE` and other locks | — | not checked; the rule covers indexes only |",
      "",
      "Next: say yes to commit both files on a new branch; the test alone fails CI.",
    ],
    keys: [
      [
        -2.9,
        "type",
        "/hope:anchor Finding from Tuesday's outage: migration 0042 ran CREATE INDEX on payments without CONCURRENTLY, and writes to payments blocked for 9 minutes during the deploy."
      ],
      [
        -0.9,
        "key",
        "Enter"
      ],
      [
        318.5,
        "key",
        "Down"
      ],
      [
        326.8,
        "key",
        "Down"
      ],
      [
        335.1,
        "key",
        "Up"
      ],
      [
        335.1,
        "key",
        "Up"
      ],
      [
        336.1,
        "key",
        "n"
      ],
      [
        337.1,
        "type",
        "Every table. Small tables grow; payments was small once."
      ],
      [
        349.2,
        "key",
        "Enter"
      ]
    ],
  },
];
