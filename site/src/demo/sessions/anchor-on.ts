import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:anchor Finding from Tuesday's outage: migration 0042 ran CREATE INDEX on payments without CONCURRENTLY, and writes to payments blocked for 9 minutes during the deploy. Turn it into a rule for the team.",
    tools: "Read 1 file, called 2 tools, ran 4 shell commands",
    activity: [
      {"at": 2.2, "line": "Listing repo files and showing migrations and runner", "tool": "$ git ls-files && cat package.json && ls migrations 2>/dev/null; for f in $(git ls-files | grep -iE 'migrat|\\.sql$|\\.md$' ); do echo \"=== $f\"; cat \"$f\"; done"},
      {"at": 18.2, "line": "Testing CONCURRENTLY behavior against local Postgres", "tool": "$ cat scripts/sql.js; npm run -s sql -- \"SELECT 1\" ; npm run -s sql -- \"CREATE TABLE IF NOT EXISTS t_anchor(x int); CREATE INDEX CONCURRENTLY t_anchor_x ON t_anchor(x);\"; npm run -s sql -- \"CREATE INDEX CONCURRENTLY t_anchor_x ON t_anchor(x)\"; npm run -s sql -- \"-- no-transaction\nCREATE INDEX CONCURRENTLY IF NOT EXISTS t_anchor_x2 ON t_anchor(x);\"; npm run -s sql -- \"DROP TABLE t_anchor\""},
      {"at": 21.2, "line": "Testing CONCURRENTLY behavior against local Postgres", "tool": "$ npm run -s sql -- \"CREATE TABLE t_anchor(x int)\"; npm run -s sql -- \"-- no-transaction\nCREATE INDEX CONCURRENTLY t_anchor_x ON t_anchor(x);\"; npm run -s sql -- \"DROP TABLE t_anchor\""},
      {"at": 84.2, "line": "The finding says 'payments', but the lock hits any table that already has rows. Which tables should the rule cover?", "tool": "$ npm run -s sql -- \"CREATE TABLE t_anchor(x int)\"; npm run -s sql -- \"-- no-transaction\nCREATE INDEX CONCURRENTLY t_anchor_x ON t_anchor(x);\"; npm run -s sql -- \"DROP TABLE t_anchor\""},
      {"at": 93.2, "line": "Showing CI workflow", "tool": "$ cat .github/workflows/ci.yml"},
      {"at": 115.2, "line": "Adding write-block check, fixing 0043, running tests", "tool": "$ python3 - <<'EOF'\np='scripts/migrate.js'\ns=open(p).read()\ns=s.replace('''import { readdirSync, readFileSync } from \"node:fs\";\n''','''import { readdirSync, readFileSync } from \"node:fs\";\n\nconst NO_TRANSACTION = \"-- no-transaction\";\n''')\ns=s.replace('const bare = sql.startsWith(\"-- no-transaction\");','const bare = sql.startsWith(NO_TRANSACTION);')\ns=s.replace('''if (import.meta.url''','''// Ways this migration would block writes to a table that already exists.\n// A CREATE INDEX on a table the file does not create must use CONCURRENTLY,\n// skip the transaction, and be the file's only statement: Postgres runs a\n// multi-statement query as one transaction, and CONCURRENTLY refuses that.\nexport function writeBlocks(sql) {\n  const body = sql.replace(/--.*$/gm, \"\");\n  const created = new Set(\n    [...body.matchAll(/create\\\\s+table\\\\s+(?:if\\\\s+not\\\\s+exists\\\\s+)?([\\\\w.\"]+)/gi)].map((m) => m[1]),\n  );\n  const statements = body.split(\";\").filter((s) => s.trim()).length;\n  const indexes = body.matchAll(\n    /create\\\\s+(?:unique\\\\s+)?index\\\\s+(concurrently\\\\s+)?(?:if\\\\s+not\\\\s+exists\\\\s+)?(?:[\\\\w\"]+\\\\s+)?on\\\\s+(?:only\\\\s+)?([\\\\w.\"]+)/gi,\n  );\n  return [...indexes]\n    .filter(([, , table]) => !created.has(table))\n    .flatMap(([, concurrently, table]) => [\n      !concurrently && `CREATE INDEX on ${table} lacks CONCURRENTLY`,\n      !sql.startsWith(NO_TRANSACTION) && `CREATE INDEX on ${table} needs a first line \"${NO_TRANSACTION}\"`,\n      statements > 1 && `CREATE INDEX on ${table} must be the only statement in its file`,\n    ].filter(Boolean));\n}\n\nif (import.meta.url''')\nopen(p,'w').write(s)\nEOF\ncat > db/migrations/0043_index_payments_created_at.sql <<'EOF'\n-- no-transaction\nCREATE INDEX CONCURRENTLY payments_created_at_idx ON payments (created_at);\nEOF\ncat > test/write-blocks.test.js <<'EOF'\nimport { test } from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { readdirSync, readFileSync } from \"node:fs\";\nimport { writeBlocks } from \"../scripts/migrate.js\";\n\n// 0040 and 0042 ran before this rule; 0042 blocked payments writes for 9 min.\nconst FIRST_CHECKED = \"0043\";\n\ntest(\"no migration from 0043 on blocks writes to an existing table\", () => {\n  for (const f of readdirSync(\"db/migrations\").filter((f) => f >= FIRST_CHECKED)) {\n    assert.deepEqual(writeBlocks(readFileSync(`db/migrations/${f}`, \"utf8\")), [], f);\n  }\n});\n\ntest(\"0042 as written breaks the rule\", () => {\n  assert.deepEqual(writeBlocks(\"CREATE INDEX payments_status_idx ON payments (status);\"), [\n    \"CREATE INDEX on payments lacks CONCURRENTLY\",\n    'CREATE INDEX on payments needs a first line \"-- no-transaction\"',\n  ]);\n});\n\ntest(\"an index on a table the same file creates is fine\", () => {\n  assert.deepEqual(writeBlocks(\"CREATE TABLE t (x int);\\nCREATE INDEX t_x ON t (x);\"), []);\n});\n\ntest(\"the concurrent form passes, alone and outside a transaction\", () => {\n  assert.deepEqual(writeBlocks(\"-- no-transaction\\nCREATE UNIQUE INDEX CONCURRENTLY t_x ON t (x);\"), []);\n});\n\ntest(\"CONCURRENTLY alone is not enough\", () => {\n  assert.deepEqual(writeBlocks(\"CREATE INDEX CONCURRENTLY ON t (x);\"), [\n    'CREATE INDEX on t needs a first line \"-- no-transaction\"',\n  ]);\n  assert.deepEqual(writeBlocks(\"-- no-transaction\\nCREATE INDEX CONCURRENTLY t_x ON t (x);\\nSELECT 1;\"), [\n    \"CREATE INDEX on t must be the only statement in its file\",\n  ]);\n});\nEOF\nnpm test 2>&1 | tail -15; for f in db/migrations/*.sql; do node -e 'import(\"./scripts/migrate.js\").then(m=>console.log(process.argv[1], JSON.stringify(m.writeBlocks(require(\"fs\").readFileSync(process.argv[1],\"utf8\")))))' $f; done"},
      {"at": 121.2, "line": "Adding write-block check, fixing 0043, running tests", "tool": "$ npm run -s sql -- \"CREATE DATABASE anchor_scratch\" && node -e '\nimport(\"pg\").then(async ({default: pg}) => {\n  const { plan } = await import(\"./scripts/migrate.js\");\n  const db = new pg.Client({host:\"127.0.0.1\",port:54329,user:\"postgres\",password:\"password\",database:\"anchor_scratch\"});\n  await db.connect();\n  for (const s of plan(\"db/migrations\", new Set())) { await db.query(s.sql); console.log(\"applied\", s.file); }\n  console.log((await db.query(\"SELECT indexrelid::regclass, indisvalid FROM pg_index WHERE indrelid = $1::regclass\", [\"payments\"])).rows);\n  await db.end();\n})'; npm run -s sql -- \"DROP DATABASE anchor_scratch\""},
      {"at": 121.2, "line": "Applying all migrations to a scratch database", "tool": "$ npm run -s sql -- \"CREATE DATABASE anchor_scratch\" && node -e '\nimport(\"pg\").then(async ({default: pg}) => {\n  const { plan } = await import(\"./scripts/migrate.js\");\n  const db = new pg.Client({host:\"127.0.0.1\",port:54329,user:\"postgres\",password:\"password\",database:\"anchor_scratch\"});\n  await db.connect();\n  for (const s of plan(\"db/migrations\", new Set())) { await db.query(s.sql); console.log(\"applied\", s.file); }\n  console.log((await db.query(\"SELECT indexrelid::regclass, indisvalid FROM pg_index WHERE indrelid = $1::regclass\", [\"payments\"])).rows);\n  await db.end();\n})'; npm run -s sql -- \"DROP DATABASE anchor_scratch\""},
    ],
    dialogs: [
      {
        "at": [
          31.3,
          83.6
        ],
        "after": 3,
        "tool": "$ npm run -s sql -- \"CREATE TABLE t_anchor(x int)\"; npm run -s sql -- \"-- no-transaction\nCREATE INDEX CONCURRENTLY t_anchor_x ON t_anchor(x);\"; npm run -s sql -- \"DROP TABLE t_anchor\"",
        "questions": [
          {
            "header": "Scope",
            "question": "The finding says 'payments', but the lock hits any table that already has rows. Which tables should the rule cover?",
            "multiSelect": false,
            "options": [
              {
                "label": "Any existing table (Recommended)",
                "description": "Trigger: CREATE INDEX on a table the same file does not CREATE TABLE. A script can check it; no one judges 'big' or 'busy'.",
                "preview": "0039 CREATE TABLE payments + index  -> ok\n0042 CREATE INDEX ON payments       -> FAIL\nnew  CREATE INDEX ON tiny_lookup    -> FAIL\n     (costs a no-transaction file;\n      never blocks writes)"
              },
              {
                "label": "Named busy tables only",
                "description": "Trigger: CREATE INDEX on a table in a list (payments, ...). Someone must keep the list current.",
                "preview": "BUSY = [\"payments\"]\n0042 CREATE INDEX ON payments    -> FAIL\nnew  CREATE INDEX ON orders      -> ok\n     (until someone adds orders\n      to the list)"
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "0043",
            "question": "db/migrations/0043_index_payments_created_at.sql has the same bug as 0042 (plain CREATE INDEX on payments). Has 0043 run in production yet?",
            "multiSelect": false,
            "options": [
              {
                "label": "Not yet",
                "description": "I rewrite 0043 to the concurrent form, and the check covers every file from 0042 on... except 0042 itself."
              },
              {
                "label": "Already ran",
                "description": "0043 stays as it is; the check starts at 0044."
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 127.1,
    chrome: [
      [-618.8, {"context": "0%", "style": "hold:Plain"}],
      [0.2, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Hashing"}}],
      [1.2, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 38 tokens · thinking with medium effort"}}],
      [1.2, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 187 tokens · thinking with medium effort"}}],
      [2.2, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 229 tokens · thought for 1s"}}],
      [3.2, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 240 tokens · thought for 1s"}}],
      [4.2, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 243 tokens · thinking with medium effort"}}],
      [14.2, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 243 tokens · still thinking with medium effort"}}],
      [15.2, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 1.3k tokens · thought for 12s"}}],
      [16.2, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 1.4k tokens · thought for 12s"}}],
      [17.2, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 1.4k tokens"}}],
      [18.2, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 1.5k tokens"}}],
      [19.2, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 1.6k tokens · thinking with medium effort"}}],
      [19.2, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 1.8k tokens · thinking with medium effort"}}],
      [20.2, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 2.0k tokens · thinking with medium effort"}}],
      [21.2, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 2.0k tokens · thought for 1s"}}],
      [22.2, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 2.0k tokens · thinking with medium effort"}}],
      [25.2, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 2.0k tokens · thought for 4s"}}],
      [26.2, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 2.2k tokens · thought for 4s"}}],
      [27.2, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 2.4k tokens · thought for 4s"}}],
      [27.2, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 2.5k tokens"}}],
      [29.2, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 2.6k tokens"}}],
      [30.2, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 2.7k tokens"}}],
      [83.2, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 3.0k tokens"}}],
      [84.2, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 3.0k tokens · thinking with medium effort"}}],
      [93.2, {"context": "4% · 43.7k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 3.8k tokens · thought for 9s"}}],
      [94.2, {"context": "4% · 43.7k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 3.9k tokens · thinking with medium effort"}}],
      [96.2, {"context": "4% · 43.7k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 4.0k tokens · thinking with medium effort"}}],
      [103.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 4.8k tokens · thought for 8s"}}],
      [103.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 4.9k tokens · thought for 8s"}}],
      [105.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 5.0k tokens"}}],
      [106.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 5.1k tokens"}}],
      [107.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 5.2k tokens"}}],
      [109.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 5.3k tokens"}}],
      [110.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 5.4k tokens"}}],
      [111.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 5.5k tokens"}}],
      [112.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 5.6k tokens"}}],
      [114.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 5.7k tokens"}}],
      [115.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 5.8k tokens"}}],
      [116.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 6.7k tokens"}}],
      [116.2, {"context": "4% · 44.8k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 6.7k tokens · thinking with medium effort"}}],
      [119.2, {"context": "5% · 47.9k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 6.8k tokens · thought for 2s"}}],
      [119.2, {"context": "5% · 47.9k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 7.0k tokens · thought for 2s"}}],
      [120.2, {"context": "5% · 47.9k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 7.1k tokens · thought for 2s"}}],
      [121.2, {"context": "5% · 47.9k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 7.2k tokens"}}],
      [122.2, {"context": "5% · 47.9k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 7.2k tokens · thinking with medium effort"}}],
      [123.2, {"context": "5% · 47.9k", "style": "hold:Plain", "spin": {"verb": "Crunching", "tail": "↓ 7.3k tokens · thinking with medium effort"}}],
      [127.1, {"context": "5% · 47.9k", "style": "hold:Plain", "band": ["questions 1"]}],
      [127.2, {"context": "5% · 48.8k", "style": "hold:Plain", "band": ["questions 1"]}],
    ],
    panes: {
      "questions": {
        chips: [],
        body: [
          [{"id": "title", "label": "questions", "kind": "title"}, {"id": "close", "label": "close", "kind": "line"}],
          [],
          [{"id": "question:0", "label": "• Nothing is committed. Next question: a failed CONCURRENTLY build leaves an invalid index, and the re-run then stops on \"already exists\". Should that be next?", "kind": "title"}],
        ],
      },
    },
    reply: [
      "The rule (CI enforces it through `test/write-blocks.test.js`):",
      "",
      "```",
      "A migration that runs CREATE INDEX on a table the same file does not",
      "CREATE TABLE must:",
      "  1. use CREATE INDEX CONCURRENTLY",
      "  2. have \"-- no-transaction\" as its first line",
      "  3. hold no other statement",
      "",
      "0042 \"CREATE INDEX payments_status_idx ON payments (status);\"",
      "  payments not created in 0042 -> rule applies",
      "  1 fails, 2 fails             -> CI rejects it",
      "```",
      "",
      "| piece | status | note |",
      "|---|---|---|",
      "| `writeBlocks()` in `scripts/migrate.js` | tested | 7/7 pass |",
      "| `writeBlocks()` in `scripts/migrate.js` | tested | flags 0040 and 0042 |",
      "| `0043` rewritten to the concurrent form | tested | all migrations apply cleanly on a scratch DB |",
      "| check covers 0043 onward | implemented | 0040 and 0042 already ran |",
      "| rule 3 | tested | a two-statement file failed against local Postgres |",
      "",
      "Nothing is committed. Next question: A failed CONCURRENTLY build leaves an invalid index. The re-run then stops on \"already exists.\" Should that be next?",
    ],
    keys: [
      [
        -1.9,
        "type",
        "/hope:anchor Finding from Tuesday's outage: migration 0042 ran CREATE INDEX on payments without CONCURRENTLY, and writes to payments blocked for 9 minutes during the deploy. Turn it into a rule for the team."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ],
      [
        53.5,
        "key",
        "Enter"
      ],
      [
        77.7,
        "key",
        "Enter"
      ],
      [
        83.6,
        "key",
        "Enter"
      ]
    ],
  },
];
