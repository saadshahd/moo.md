import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:shape The vendor webhook fails when a translator publishes: several posts for the same package land together, some 500 on the package lock, and their keys are lost. test/webhook.test.js reproduces it. Fix it.",
    tools: "Edited 1 file +47, called 2 tools, ran 2 shell commands",
    activity: [
      {"at": 8.1, "line": "Running ls -R src test && cat package.json src/\\*.js test/…", "tool": "$ ls -R src test && cat package.json src/*.js test/*.js && git log --stat | head -30"},
      {"at": 20.1, "line": "Running npm test **2**>&**1** | tail -**15**; S=$TMPDIR/g**3** && rm -rf …", "tool": "$ npm test 2>&1 | tail -15; S=$TMPDIR/g3 && rm -rf $S && cp -R . $S && cd $S && cat > src/webhook.js <<'EOF'\nexport function createWebhook({ db, vendor }) {\n  return async function handle(event) {\n    try {\n      const keys = await vendor.fetchBatch(event.batchId);\n      await db.withRowLock(\"packages\", event.packageId, async (pkg, save) => {\n        if (!pkg) throw Object.assign(new Error(\"unknown package\"), { status: 404 });\n        await save({ ...pkg, keys: { ...pkg.keys, ...keys }, updatedAt: new Date().toISOString() });\n      });\n      return { status: 200 };\n    } catch (err) {\n      console.error(`webhook ${event.batchId}: ${err.message}`);\n      return { status: err.status ?? 500 };\n    }\n  };\n}\nEOF\nnpm test 2>&1 | grep -E \"^# (pass|fail)|webhook b\"; node -e 'import(\"./test/helpers.js\").then(({setup})=>{const {db}=setup({latencyMs:1});console.log(JSON.stringify(db.get(\"packages\",\"checkout\")).length)})'"},
      {"at": 199.1, "line": "Moving the vendor fetch out of the lock is not enough: each save rewrites the 4,000-key row (~217 ms), so 8 posts in a row pass the 1 s lock timeout (I ran it). My fix is to have each process combine the waiting batches into one save per package. That only works if few processes serve the webhook. How many processes serve POST /webhooks/vendor in production?", "tool": "$ npm test 2>&1 | tail -15; S=$TMPDIR/g3 && rm -rf $S && cp -R . $S && cd $S && cat > src/webhook.js <<'EOF'\nexport function createWebhook({ db, vendor }) {\n  return async function handle(event) {\n    try {\n      const keys = await vendor.fetchBatch(event.batchId);\n      await db.withRowLock(\"packages\", event.packageId, async (pkg, save) => {\n        if (!pkg) throw Object.assign(new Error(\"unknown package\"), { status: 404 });\n        await save({ ...pkg, keys: { ...pkg.keys, ...keys }, updatedAt: new Date().toISOString() });\n      });\n      return { status: 200 };\n    } catch (err) {\n      console.error(`webhook ${event.batchId}: ${err.message}`);\n      return { status: err.status ?? 500 };\n    }\n  };\n}\nEOF\nnpm test 2>&1 | grep -E \"^# (pass|fail)|webhook b\"; node -e 'import(\"./test/helpers.js\").then(({setup})=>{const {db}=setup({latencyMs:1});console.log(JSON.stringify(db.get(\"packages\",\"checkout\")).length)})'"},
      {"at": 217.1, "line": "Writing src/webhook.js", "tool": "$ npm test 2>&1 | tail -15; S=$TMPDIR/g3 && rm -rf $S && cp -R . $S && cd $S && cat > src/webhook.js <<'EOF'\nexport function createWebhook({ db, vendor }) {\n  return async function handle(event) {\n    try {\n      const keys = await vendor.fetchBatch(event.batchId);\n      await db.withRowLock(\"packages\", event.packageId, async (pkg, save) => {\n        if (!pkg) throw Object.assign(new Error(\"unknown package\"), { status: 404 });\n        await save({ ...pkg, keys: { ...pkg.keys, ...keys }, updatedAt: new Date().toISOString() });\n      });\n      return { status: 200 };\n    } catch (err) {\n      console.error(`webhook ${event.batchId}: ${err.message}`);\n      return { status: err.status ?? 500 };\n    }\n  };\n}\nEOF\nnpm test 2>&1 | grep -E \"^# (pass|fail)|webhook b\"; node -e 'import(\"./test/helpers.js\").then(({setup})=>{const {db}=setup({latencyMs:1});console.log(JSON.stringify(db.get(\"packages\",\"checkout\")).length)})'"},
      {"at": 226.1, "line": "Running cat >> test/webhook.test.js <<'EOF' test(\"a publis…", "tool": "$ cat >> test/webhook.test.js <<'EOF'\n\ntest(\"a publish burst of 40 posts, vendor slow and uneven, stores every key\", async () => {\n  const db = createDb({ lockTimeoutMs: 1000 });\n  db.insert(\"packages\", \"checkout\", { id: \"checkout\", keys: batch(\"base\", 4000) });\n  const ids = Array.from({ length: 40 }, (_, i) => `b${i + 1}`);\n  const vendor = {\n    fetchBatch: (id) => new Promise((r) => setTimeout(() => r(batch(id, 11)), 500 + Math.random() * 1500)),\n  };\n  const handle = createWebhook({ db, vendor });\n  const results = await Promise.all(ids.map((batchId) => handle({ packageId: \"checkout\", batchId })));\n  assert.deepEqual(results.map((r) => r.status), ids.map(() => 200));\n  assert.equal(Object.keys(db.get(\"packages\", \"checkout\").keys).length, 4440);\n});\n\ntest(\"a failed vendor fetch fails only its own post\", async () => {\n  const db = createDb({ lockTimeoutMs: 1000 });\n  db.insert(\"packages\", \"checkout\", { id: \"checkout\", keys: batch(\"base\", 4000) });\n  const vendor = {\n    fetchBatch: (id) => new Promise((resolve, reject) =>\n      setTimeout(() => (id === \"bad\" ? reject(new Error(\"vendor 502\")) : resolve(batch(id, 11))), 100)),\n  };\n  const handle = createWebhook({ db, vendor });\n  const results = await Promise.all([\"b1\", \"bad\", \"b2\"].map((batchId) => handle({ packageId: \"checkout\", batchId })));\n  assert.deepEqual(results.map((r) => r.status), [200, 500, 200]);\n  assert.equal(Object.keys(db.get(\"packages\", \"checkout\").keys).length, 4022);\n});\nEOF\nsed -i '' 's#^import { setup } from \"./helpers.js\";#import { batch, setup } from \"./helpers.js\";\\nimport { createDb } from \"../src/db.js\";\\nimport { createWebhook } from \"../src/webhook.js\";#' test/webhook.test.js\nhead -6 test/webhook.test.js; for i in 1 2 3; do npm test 2>&1 | grep -E \"^# (pass|fail)|^not ok\"; done\ngit stash -q -- src/webhook.js && npm test 2>&1 | grep -E \"^# (pass|fail)|^not ok\"; git stash pop -q && git status --short"},
      {"at": 243.1, "line": "Running cat >> test/webhook.test.js <<'EOF' test(\"a publis…", "tool": "$ npm test 2>&1 | tail -15; S=$TMPDIR/g3 && rm -rf $S && cp -R . $S && cd $S && cat > src/webhook.js <<'EOF'\nexport function createWebhook({ db, vendor }) {\n  return async function handle(event) {\n    try {\n      const keys = await vendor.fetchBatch(event.batchId);\n      await db.withRowLock(\"packages\", event.packageId, async (pkg, save) => {\n        if (!pkg) throw Object.assign(new Error(\"unknown package\"), { status: 404 });\n        await save({ ...pkg, keys: { ...pkg.keys, ...keys }, updatedAt: new Date().toISOString() });\n      });\n      return { status: 200 };\n    } catch (err) {\n      console.error(`webhook ${event.batchId}: ${err.message}`);\n      return { status: err.status ?? 500 };\n    }\n  };\n}\nEOF\nnpm test 2>&1 | grep -E \"^# (pass|fail)|webhook b\"; node -e 'import(\"./test/helpers.js\").then(({setup})=>{const {db}=setup({latencyMs:1});console.log(JSON.stringify(db.get(\"packages\",\"checkout\")).length)})'"},
    ],
    dialogs: [
      {
        "at": [
          91.5,
          199.0
        ],
        "after": 2,
        "tool": "$ npm test 2>&1 | tail -15; S=$TMPDIR/g3 && rm -rf $S && cp -R . $S && cd $S && cat > src/webhook.js <<'EOF'\nexport function createWebhook({ db, vendor }) {\n  return async function handle(event) {\n    try {\n      const keys = await vendor.fetchBatch(event.batchId);\n      await db.withRowLock(\"packages\", event.packageId, async (pkg, save) => {\n        if (!pkg) throw Object.assign(new Error(\"unknown package\"), { status: 404 });\n        await save({ ...pkg, keys: { ...pkg.keys, ...keys }, updatedAt: new Date().toISOString() });\n      });\n      return { status: 200 };\n    } catch (err) {\n      console.error(`webhook ${event.batchId}: ${err.message}`);\n      return { status: err.status ?? 500 };\n    }\n  };\n}\nEOF\nnpm test 2>&1 | grep -E \"^# (pass|fail)|webhook b\"; node -e 'import(\"./test/helpers.js\").then(({setup})=>{const {db}=setup({latencyMs:1});console.log(JSON.stringify(db.get(\"packages\",\"checkout\")).length)})'",
        "questions": [
          {
            "header": "Processes",
            "question": "Moving the vendor fetch out of the lock is not enough: each save rewrites the 4,000-key row (~217 ms), so 8 posts in a row pass the 1 s lock timeout (I ran it). My fix is to have each process combine the waiting batches into one save per package. That only works if few processes serve the webhook. How many processes serve POST /webhooks/vendor in production?",
            "multiSelect": false,
            "options": [
              {
                "label": "One process",
                "description": "Each process combining the waiting batches into one save fixes it fully.",
                "preview": "webhook.js only:\n  fetch batch (no lock)\n  join package queue\n  one writer: lock -> merge all queued -> save\n  each post answers 200 after the save holding its keys"
              },
              {
                "label": "2–4 processes",
                "description": "Combined saves still hold: at worst ~3 saves wait in line, under 1 s.",
                "preview": "same as one process;\nworst wait ~ (K-1) x 217 ms < 1 s"
              },
              {
                "label": "5+ or autoscaled",
                "description": "Combined saves are not enough; store keys one row each (schema change).",
                "preview": "package_keys table:\n  (package_id, key) -> translations\nupsert only the batch's keys\nno full-row rewrite; readers of package.keys change"
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "Retries",
            "question": "When our webhook answers 500, does the vendor send that batch again later?",
            "multiSelect": false,
            "options": [
              {
                "label": "Yes, it retries",
                "description": "A rare leftover 500 delays keys but loses none."
              },
              {
                "label": "No retry",
                "description": "Any 500 loses keys, so the fix must leave none."
              },
              {
                "label": "I don't know",
                "description": "I'll treat any 500 as lost keys."
              }
            ],
            "picked": [
              1
            ]
          }
        ]
      }
    ],
    replyAt: 252.9,
    chrome: [
      [-2.9, {"context": "0%", "style": "hold:Plain"}],
      [0.1, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Channeling"}}],
      [6.1, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": ""}}],
      [7.1, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 137 tokens"}}],
      [8.1, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 188 tokens"}}],
      [8.1, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 199 tokens"}}],
      [9.1, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 200 tokens"}}],
      [16.1, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 771 tokens"}}],
      [17.1, {"context": "4% · 41.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 786 tokens"}}],
      [18.1, {"context": "4% · 41.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 859 tokens"}}],
      [18.1, {"context": "4% · 41.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 934 tokens"}}],
      [19.1, {"context": "4% · 41.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 976 tokens"}}],
      [20.1, {"context": "4% · 41.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 1.0k tokens"}}],
      [24.1, {"context": "4% · 41.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 1.2k tokens"}}],
      [24.1, {"context": "4% · 41.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 1.3k tokens"}}],
      [30.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 1.4k tokens"}}],
      [31.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 1.6k tokens"}}],
      [31.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 1.7k tokens"}}],
      [32.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 1.8k tokens"}}],
      [86.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 2.0k tokens"}}],
      [87.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 2.1k tokens"}}],
      [88.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 2.2k tokens"}}],
      [90.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 2.3k tokens"}}],
      [91.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 2.4k tokens"}}],
      [198.1, {"context": "4% · 43k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 2.5k tokens"}}],
      [199.1, {"context": "4% · 44.4k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 2.5k tokens"}}],
      [211.1, {"context": "4% · 44.4k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 3.6k tokens"}}],
      [212.1, {"context": "5% · 45.4k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 3.6k tokens"}}],
      [213.1, {"context": "5% · 45.4k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 3.7k tokens"}}],
      [214.1, {"context": "5% · 45.4k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 3.8k tokens"}}],
      [215.1, {"context": "5% · 45.4k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 3.9k tokens"}}],
      [216.1, {"context": "5% · 45.4k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 4.0k tokens"}}],
      [217.1, {"context": "5% · 45.4k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 4.2k tokens"}}],
      [218.1, {"context": "5% · 45.4k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 4.4k tokens"}}],
      [220.1, {"context": "5% · 47.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 4.6k tokens"}}],
      [221.1, {"context": "5% · 47.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 4.7k tokens"}}],
      [222.1, {"context": "5% · 47.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 4.8k tokens"}}],
      [222.1, {"context": "5% · 47.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 4.9k tokens"}}],
      [223.1, {"context": "5% · 47.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 5.0k tokens"}}],
      [225.1, {"context": "5% · 47.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 5.1k tokens"}}],
      [226.1, {"context": "5% · 47.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 5.2k tokens"}}],
      [230.1, {"context": "5% · 47.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 5.4k tokens"}}],
      [231.1, {"context": "5% · 47.5k", "style": "hold:Plain", "spin": {"verb": "Hyperspacing", "tail": "↓ 5.5k tokens"}}],
      [253.1, {"context": "5% · 48.7k", "style": "hold:Plain"}],
    ],
    reply: [
      "The webhook fix is implemented and tested.",
      "`npm test` passes 6/6 on three runs.",
      "On the old `src/webhook.js`, the 8-post test fails.",
      "On the old `src/webhook.js`, the 40-post test fails.",
      "",
      "| piece | status | note |",
      "|---|---|---|",
      "| `src/webhook.js` | implemented | Fetch runs outside the lock |",
      "| `src/webhook.js` | implemented | One save per package at a time |",
      "| burst test, 40 posts, vendor 0.5–2 s | tested | all 200s |",
      "| failed vendor fetch test | tested | only that post 500s |",
      "| failed vendor fetch test | tested | the other posts save |",
      "| what's left | gap | a failed save gives every post in it a 500 |",
      "| what's left | gap | vendor won't retry |",
      "",
      "Next: review the diff and commit it.",
      "I left both files uncommitted.",
    ],
    keys: [
      [
        -1.9,
        "type",
        "/hope:shape The vendor webhook fails when a translator publishes: several posts for the same package land together, some 500 on the package lock, and their keys are lost. test/webhook.test.js reproduces it. Fix it."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ],
      [
        146.7,
        "key",
        "Enter"
      ],
      [
        178.7,
        "key",
        "Down"
      ],
      [
        183.7,
        "key",
        "Enter"
      ],
      [
        198.9,
        "key",
        "Enter"
      ]
    ],
  },
];
