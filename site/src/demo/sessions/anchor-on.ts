import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:anchor Finding from Tuesday's outage: migration 0042 ran CREATE INDEX on payments without CONCURRENTLY, and writes to payments blocked for 9 minutes during the deploy. Turn it into a rule for the team that covers every table, not only payments, except a table created in the same migration.",
    tools: "Ran 4 shell commands",
    activity: [
      {"at": 1.7, "line": "Listing repo files and showing their contents", "tool": "$ git ls-files && cat package.json && ls migrations 2>/dev/null; for f in $(git ls-files | grep -v -e package -e CLAUDE); do echo \"=== $f\"; cat \"$f\"; done"},
      {"at": 14.7, "line": "Testing CONCURRENTLY behavior on local Postgres", "tool": "$ npm run sql -- \"select version()\" 2>&1 | tail -2; npm run sql -- \"CREATE TABLE t1(a int); CREATE INDEX CONCURRENTLY t1_a ON t1(a);\" 2>&1 | tail -1; npm run sql -- \"CREATE TABLE t2(a int)\" | tail -1; npm run sql -- \"CREATE INDEX CONCURRENTLY t2_a ON t2(a)\" | tail -1; npm run sql -- \"BEGIN; CREATE TABLE t3(a int); CREATE INDEX t3_a ON t3(a); COMMIT;\" | tail -1; npm run sql -- \"CREATE TABLE p(a int) PARTITION BY RANGE(a)\" | tail -1; npm run sql -- \"CREATE INDEX CONCURRENTLY p_a ON p(a)\" | tail -1; npm run sql -- \"DROP TABLE IF EXISTS t1,t2,t3,p\" | tail -1"},
      {"at": 85.7, "line": "Running a CONCURRENTLY migration through the real runner path", "tool": "$ d=$(mktemp -d) && printf -- '-- no-transaction\\nCREATE INDEX CONCURRENTLY payments_status_idx ON payments (status);\\n' > $d/0042_x.sql && printf -- '-- no-transaction\\nCREATE INDEX CONCURRENTLY a ON payments (status);\\nSELECT 1;\\n' > $d/0043_y.sql && npm run sql -- \"CREATE TABLE IF NOT EXISTS payments (id bigserial PRIMARY KEY, status text)\" | tail -1 && node -e '\nimport(\"./scripts/migrate.js\").then(async ({plan})=>{const {default:pg}=await import(\"pg\");const db=new pg.Client(\"postgres://postgres:password@127.0.0.1:54329/postgres\");await db.connect();\nfor(const s of plan(process.argv[1],new Set())){try{await db.query(s.sql);console.log(s.file,\"ok\")}catch(e){console.log(s.file,\"ERR\",e.message)}}\nawait db.query(\"DROP INDEX IF EXISTS payments_status_idx, a\");await db.end()})' $d; npm run sql -- \"select indexname from pg_indexes where tablename='payments'\" | tail -3"},
      {"at": 90.7, "line": "Running CONCURRENTLY migrations through the runner's plan()", "tool": "$ d=\"$TMPDIR/anchor-probe\" && rm -rf \"$d\" && mkdir -p \"$d\" && printf -- '-- no-transaction\\nCREATE INDEX CONCURRENTLY probe_status_idx ON anchor_probe (status);\\n' > $d/0001_x.sql && printf -- '-- no-transaction\\nCREATE INDEX CONCURRENTLY probe_b ON anchor_probe (status);\\nSELECT 1;\\n' > $d/0002_y.sql && npm run sql -- \"CREATE TABLE anchor_probe (id bigserial PRIMARY KEY, status text)\" | tail -1 && node -e '\nimport(\"./scripts/migrate.js\").then(async ({plan})=>{const {default:pg}=await import(\"pg\");const db=new pg.Client(\"postgres://postgres:password@127.0.0.1:54329/postgres\");await db.connect();\nfor(const s of plan(process.argv[1],new Set())){try{await db.query(s.sql);console.log(s.file,\"ok\")}catch(e){console.log(s.file,\"ERR\",e.message)}}\nawait db.query(\"DROP TABLE anchor_probe\");await db.end()})' $d; rm -rf \"$d\""},
    ],
    replyAt: 101.0,
    chrome: [
      [-4.3, {"context": "0%", "style": "hold:Plain"}],
      [-0.3, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Waddling"}}],
      [0.7, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "thinking with medium effort"}}],
      [0.7, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 88 tokens · thinking with medium effort"}}],
      [1.7, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 218 tokens"}}],
      [2.7, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 233 tokens · thought for 1s"}}],
      [3.7, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 240 tokens · thought for 1s"}}],
      [3.7, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 240 tokens · thinking with medium effort"}}],
      [11.7, {"context": "4% · 41.1k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 1.0k tokens · thought for 8s"}}],
      [13.7, {"context": "4% · 41.1k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 1.1k tokens"}}],
      [14.7, {"context": "4% · 41.1k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 1.2k tokens"}}],
      [16.7, {"context": "4% · 41.1k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 1.4k tokens"}}],
      [16.7, {"context": "4% · 41.1k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 1.4k tokens · thinking with medium effort"}}],
      [17.7, {"context": "4% · 41.1k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 1.5k tokens · thinking with medium effort"}}],
      [23.7, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.0k tokens · thought for 7s"}}],
      [25.7, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.0k tokens"}}],
      [81.7, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.1k tokens"}}],
      [83.7, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.2k tokens"}}],
      [84.7, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.3k tokens"}}],
      [85.7, {"context": "4% · 44.1k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.4k tokens"}}],
      [85.7, {"context": "4% · 44.1k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.5k tokens"}}],
      [86.7, {"context": "4% · 44.1k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.6k tokens · thinking with medium effort"}}],
      [87.7, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.8k tokens · thinking with medium effort"}}],
      [88.7, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 2.9k tokens · thought for 1s"}}],
      [88.7, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 3.0k tokens · thought for 1s"}}],
      [90.7, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 3.1k tokens"}}],
      [90.7, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 3.2k tokens"}}],
      [91.7, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Ruminating", "tail": "↓ 3.2k tokens · thinking with medium effort"}}],
      [101.0, {"context": "5% · 45.5k", "style": "hold:Plain", "band": ["questions 1"]}],
    ],
    panes: {
      "questions": {
        chips: [],
        body: [
          [{"id": "title", "label": "questions", "kind": "title"}, {"id": "close", "label": "close", "kind": "line"}],
          [],
          [{"id": "question:0", "label": "• Should fixing 0043 come next, along with a test in `test/` that enforces this rule?", "kind": "title"}],
        ],
      },
    },
    reply: [
      "Rule: every `CREATE INDEX` on a table the same file did not create must use `CONCURRENTLY` and sit alone in a `-- no-transaction` file.",
      "",
      "```",
      "for each CREATE [UNIQUE] INDEX ... ON <T> in a db/migrations/*.sql file:",
      "  if the same file has CREATE TABLE <T>        -> pass (exempt)",
      "  else if the statement lacks CONCURRENTLY     -> reject",
      "  else if line 1 is not \"-- no-transaction\"    -> reject",
      "  else if the file holds any other statement   -> reject",
      "  else                                         -> pass",
      "```",
      "",
      "| case | verdict | why |",
      "|---|---|---|",
      "| 0042 `CREATE INDEX payments_status_idx ON payments` | reject | 0039 created payments, not 0042; no CONCURRENTLY |",
      "| 0042 rewritten (text below) | pass | tested through the runner's `plan()` on local Postgres |",
      "| 0043 `payments_created_at_idx` | reject | same defect as 0042, newest commit |",
      "| 0040 `payments_order_id_idx` | reject | already applied; the runner skips edited files by name |",
      "| 0039 `CREATE TABLE payments` | pass | its primary-key index comes from `CREATE TABLE` |",
      "| CONCURRENTLY + a second statement in one file | reject | tested: Postgres says \"cannot run inside a transaction block\" |",
      "| index on a partitioned parent table | gap | Postgres refuses CONCURRENTLY there; this repo has none |",
      "",
      "```sql",
      "-- no-transaction",
      "CREATE INDEX CONCURRENTLY payments_status_idx ON payments (status);",
      "```",
      "",
      "I don't know whether production has run 0043. If not, the next deploy blocks writes again.",
      "Should fixing 0043 come next, along with a test in `test/` that enforces this rule?",
    ],
    keys: [
      [
        -3.3,
        "type",
        "/hope:anchor Finding from Tuesday's outage: migration 0042 ran CREATE INDEX on payments without CONCURRENTLY, and writes to payments blocked for 9 minutes during the deploy. Turn it into a rule for the team that covers every table, not only"
      ],
      [
        -2.0,
        "type",
        " payments, except a table created in the same migration."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
];
