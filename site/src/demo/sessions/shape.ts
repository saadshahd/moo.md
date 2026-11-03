import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "The vendor webhook fails when a translator publishes: several posts for the same package land together, some 500 on the package lock, and their keys are lost. test/webhook.test.js reproduces it. Fix it.",
    tools: "Edited 1 file +55, called 1 tool, ran 2 shell commands",
    activity: [
      {"at": 2.5, "line": "Running ls -a && cat src/\\*.js test/\\*.js package.json && n…", "tool": "$ ls -a && cat src/*.js test/*.js package.json && npm test 2>&1 | tail -30"},
      {"at": 13.5, "line": "Running node -e 'import(\"./test/helpers.js\").then(({batch…", "tool": "$ node -e 'import(\"./test/helpers.js\").then(({batch})=>console.log(JSON.stringify({id:\"checkout\",keys:batch(\"base\",4000)}).length))'"},
      {"at": 59.5, "line": "Writing src/webhook.js", "tool": "$ node -e 'import(\"./test/helpers.js\").then(({batch})=>console.log(JSON.stringify({id:\"checkout\",keys:batch(\"base\",4000)}).length))'"},
      {"at": 68.5, "line": "Running cat >> test/webhook.test.js <<'EOF' test(\"forty po…", "tool": "$ cat >> test/webhook.test.js <<'EOF'\n\ntest(\"forty posts for one package at once store all 440 new keys\", async () => {\n  const db = createDb({ lockTimeoutMs: 1000 });\n  db.insert(\"packages\", \"checkout\", { id: \"checkout\", keys: batch(\"base\", 4000) });\n  const ids = Array.from({ length: 40 }, (_, i) => `b${i + 1}`);\n  const batches = Object.fromEntries(ids.map((id) => [id, batch(id, 11)]));\n  const handle = createWebhook({ db, vendor: fakeVendor(batches, 300) });\n  const results = await Promise.all(ids.map((batchId) => handle({ packageId: \"checkout\", batchId })));\n  assert.deepEqual(results.map((r) => r.status), ids.map(() => 200));\n  assert.equal(Object.keys(db.get(\"packages\", \"checkout\").keys).length, 4440);\n});\n\ntest(\"a failed vendor fetch fails only its own post\", async () => {\n  const { db } = setup({ latencyMs: 0 });\n  const ok = fakeVendor({ b1: batch(\"cart\", 11), b3: batch(\"ship\", 11) }, 300);\n  const vendor = { fetchBatch: (id) => (id === \"b2\" ? Promise.reject(new Error(\"vendor 503\")) : ok.fetchBatch(id)) };\n  const handle = createWebhook({ db, vendor });\n  const results = await Promise.all([\"b1\", \"b2\", \"b3\"].map((batchId) => handle({ packageId: \"checkout\", batchId })));\n  assert.deepEqual(results.map((r) => r.status), [200, 500, 200]);\n  assert.equal(Object.keys(db.get(\"packages\", \"checkout\").keys).length, 4022);\n});\nEOF\nsed -i '' 's#^import { setup } from \"./helpers.js\";#import { batch, fakeVendor, setup } from \"./helpers.js\";\\nimport { createDb } from \"../src/db.js\";\\nimport { createWebhook } from \"../src/webhook.js\";#' test/webhook.test.js\nnpm test 2>&1 | grep -E \"^(not )?ok|^# (pass|fail)\"; git stash -q -- src && npm test 2>&1 | grep -E \"^(not )?ok\"; git stash pop -q && git status --short"},
      {"at": 75.5, "line": "Running cat >> test/webhook.test.js <<'EOF' test(\"forty po…", "tool": "$ node -e 'import(\"./test/helpers.js\").then(({batch})=>console.log(JSON.stringify({id:\"checkout\",keys:batch(\"base\",4000)}).length))'"},
    ],
    replyAt: 84.8,
    chrome: [
      [-9.5, {"context": "0%"}],
      [0.5, {"context": "0%", "spin": {"verb": "Warping"}}],
      [1.5, {"context": "0%", "spin": {"verb": "Orbiting"}}],
      [2.5, {"context": "0%", "spin": {"verb": "Orbiting", "tail": "↓ 17 tokens"}}],
      [3.5, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 28 tokens"}}],
      [3.5, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 29 tokens"}}],
      [5.5, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 82 tokens"}}],
      [6.5, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 94 tokens · thinking with medium effort"}}],
      [7.5, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 97 tokens · thinking with medium effort"}}],
      [13.5, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 663 tokens · thought for 7s"}}],
      [13.5, {"context": "4% · 36.3k", "spin": {"verb": "Orbiting", "tail": "↓ 685 tokens · thought for 7s"}}],
      [14.5, {"context": "4% · 36.3k", "spin": {"verb": "Orbiting", "tail": "↓ 831 tokens · thought for 7s"}}],
      [15.5, {"context": "4% · 36.3k", "spin": {"verb": "Orbiting", "tail": "↓ 843 tokens · thinking with medium effort"}}],
      [16.5, {"context": "4% · 36.3k", "spin": {"verb": "Orbiting", "tail": "↓ 901 tokens · thinking with medium effort"}}],
      [16.5, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.0k tokens · thinking with medium effort"}}],
      [17.5, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.0k tokens · thought for 1s"}}],
      [19.5, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.0k tokens"}}],
      [52.5, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.1k tokens"}}],
      [54.5, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.2k tokens"}}],
      [55.5, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.3k tokens"}}],
      [56.5, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.4k tokens"}}],
      [57.5, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.5k tokens"}}],
      [58.5, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.6k tokens"}}],
      [59.5, {"context": "4% · 38k", "spin": {"verb": "Orbiting", "tail": "↓ 1.8k tokens"}}],
      [60.5, {"context": "4% · 38k", "spin": {"verb": "Orbiting", "tail": "↓ 1.9k tokens"}}],
      [60.5, {"context": "4% · 38k", "spin": {"verb": "Orbiting", "tail": "↓ 1.9k tokens · thinking with medium effort"}}],
      [62.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.0k tokens · thinking with medium effort"}}],
      [63.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.2k tokens · thought for 1s"}}],
      [63.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.3k tokens · thought for 1s"}}],
      [64.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.4k tokens · thought for 1s"}}],
      [65.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.4k tokens"}}],
      [65.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.5k tokens"}}],
      [66.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.6k tokens"}}],
      [68.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.7k tokens"}}],
      [71.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.9k tokens"}}],
      [76.5, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.9k tokens · thinking with medium effort"}}],
      [84.5, {"context": "4% · 40.4k", "spin": {"verb": "Orbiting", "tail": "↓ 3.0k tokens · thought for 7s"}}],
      [84.5, {"context": "4% · 40.4k"}],
    ],
    reply: [
      "I fixed it. All 6 tests pass, including the burst test that reproduced the bug. With the old `src/webhook.js` swapped back in, both burst tests fail.",
      "",
      "**Cause.** There were two problems, and fixing only the first would not have been enough:",
      "1. The handler fetched from the vendor while it held the package row lock. The vendor takes 0.5–2 s and the lock timeout is 1 s, so with just two posts at once, the second one gave up waiting and returned 500.",
      "2. Saving the package row is expensive. The test package is about 217 KB, so each save takes about 217 ms. Even with the fetch moved outside the lock, 8 posts saving one after another take about 1.7 s, so the last ones still time out. A 40-batch publish would take about 9 s.",
      "",
      "**Fix (all in `src/webhook.js`; the handler's signature, `db.js` and the lock timeout are unchanged):**",
      "- The vendor fetch now happens before the lock is taken.",
      "- Posts for the same package are combined. Each post adds its keys to a per-package queue, and one save at a time takes the row lock, applies everything queued, and saves once. Posts that arrive while the save is waiting for the lock are included in it; posts that arrive during the save go into the next one.",
      "- A post returns 200 only after the save that holds its keys has succeeded, so we never acknowledge keys we haven't stored. If a save fails (lock timeout, error, or unknown package), every post in it gets the real status (500 or 404). A failed vendor fetch fails only its own post.",
      "",
      "**Tests added** in `test/webhook.test.js`:",
      "- A burst of 40 posts for one package, the most the vendor sends in production. All return 200 and the package ends up with 4,440 keys.",
      "- A burst where one vendor fetch fails. That post gets 500 and the other posts' keys are stored.",
      "",
      "**Things to know:**",
      "- **This only helps within one process.** If the webhook runs on several servers, a burst spread across them still competes for the row lock, though much less than before. The fix that would hold up there is to stop rewriting a 4,000-key row on every batch, for example by storing one row per key or per batch. That's a schema change, so I didn't make it.",
      "- An unknown package now gets its 404 after the vendor fetch rather than before.",
      "",
      "I haven't committed anything.",
    ],
    keys: [
      [
        -1.7,
        "type",
        "The vendor webhook fails when a translator publishes: several posts for the same package land together, some 500 on the package lock, and their keys are lost. test/webhook.test.js reproduces it. Fix it."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
  {
    user: "/hope:shape",
    tools: "Called 3 tools, ran 1 shell command",
    activity: [
      {"at": 6.6, "line": "Running git ls-files && ls .claude && git log --oneline", "tool": "$ git ls-files && ls .claude && git log --oneline"},
      {"at": 47.6, "line": "Today's fix combines a burst of posts into one save, but only inside one server process. The repo doesn't say how many processes run the webhook in production. Which describes it?", "tool": "$ git ls-files && ls .claude && git log --oneline"},
      {"at": 78.6, "line": "With each batch stored as its own row, readers can no longer find every key in packages.keys at once. How should they see the merged keys?", "tool": "$ git ls-files && ls .claude && git log --oneline"},
      {"at": 81.6, "line": "Calling **3** tools, running **1** shell command…", "tool": "$ git ls-files && ls .claude && git log --oneline"},
    ],
    launches: [
      {"at": 81.235, "skill": "hope:inversion"},
    ],
    dialogs: [
      {
        "at": [
          13.7,
          47.2
        ],
        "after": 1,
        "tool": "$ git ls-files && ls .claude && git log --oneline",
        "questions": [
          {
            "header": "Instances",
            "question": "Today's fix combines a burst of posts into one save, but only inside one server process. The repo doesn't say how many processes run the webhook in production. Which describes it?",
            "multiSelect": false,
            "options": [
              {
                "label": "One process",
                "description": "Keep the in-process fix as it is. It's tested with bursts of up to 40 posts.",
                "preview": "POST x40 -> one process\n  fetch (no lock)\n  queue per package\n  one locked save per drain\nworks: all 40 -> 200"
              },
              {
                "label": "Several processes",
                "description": "The combining no longer holds across processes. Change the schema: store each batch as its own row and stop rewriting the 4,000-key row.",
                "preview": "POST -> any process\n  fetch (no lock)\n  INSERT batch row (no lock on package)\nreader merges batch rows,\nor a compactor folds them\ninto packages.keys later"
              },
              {
                "label": "Don't know yet",
                "description": "Ship the in-process fix now, and write the multi-process limit down as a known gap.",
                "preview": "ship in-process fix\n+ note: bursts split across\n  processes still compete\n  for the package lock"
              }
            ],
            "picked": [
              1
            ]
          }
        ]
      },
      {
        "at": [
          55.0,
          78.2
        ],
        "after": 2,
        "tool": "$ git ls-files && ls .claude && git log --oneline",
        "questions": [
          {
            "header": "Read path",
            "question": "With each batch stored as its own row, readers can no longer find every key in packages.keys at once. How should they see the merged keys?",
            "multiSelect": false,
            "options": [
              {
                "label": "Compactor folds (Recommended)",
                "description": "Readers keep using packages.keys and see new keys a few seconds late. One worker per package folds batch rows into it; a skipped lock just tries again later.",
                "preview": "webhook: INSERT package_batches\n  (package_id, batch_id, keys)\n  ON CONFLICT (batch_id) DO NOTHING\ncompactor (per package, SKIP LOCKED):\n  lock package row\n  merge unfolded batches in order\n  save once, mark them folded\nreaders: packages.keys (as today)"
              },
              {
                "label": "Merge on read",
                "description": "No worker, and readers see new keys at once. Every read merges the base keys with all of the package's batch rows, so reads get slower as batches pile up.",
                "preview": "webhook: INSERT package_batches\nreader:\n  base = packages.keys\n  for b in batches order by received_at:\n    base = {...base, ...b.keys}\n(batch rows never cleaned up\n unless you add a compactor anyway)"
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 92.0,
    chrome: [
      [-415.4, {"context": "0%", "spin": {"verb": "Warping"}}],
      [-414.4, {"context": "0%", "spin": {"verb": "Orbiting"}}],
      [-413.4, {"context": "0%", "spin": {"verb": "Orbiting", "tail": "↓ 17 tokens"}}],
      [-412.4, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 28 tokens"}}],
      [-412.4, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 29 tokens"}}],
      [-410.4, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 82 tokens"}}],
      [-409.4, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 94 tokens · thinking with medium effort"}}],
      [-408.4, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 97 tokens · thinking with medium effort"}}],
      [-402.4, {"context": "3% · 33.4k", "spin": {"verb": "Orbiting", "tail": "↓ 663 tokens · thought for 7s"}}],
      [-402.4, {"context": "4% · 36.3k", "spin": {"verb": "Orbiting", "tail": "↓ 685 tokens · thought for 7s"}}],
      [-401.4, {"context": "4% · 36.3k", "spin": {"verb": "Orbiting", "tail": "↓ 831 tokens · thought for 7s"}}],
      [-400.4, {"context": "4% · 36.3k", "spin": {"verb": "Orbiting", "tail": "↓ 843 tokens · thinking with medium effort"}}],
      [-399.4, {"context": "4% · 36.3k", "spin": {"verb": "Orbiting", "tail": "↓ 901 tokens · thinking with medium effort"}}],
      [-399.4, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.0k tokens · thinking with medium effort"}}],
      [-398.4, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.0k tokens · thought for 1s"}}],
      [-396.4, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.0k tokens"}}],
      [-363.4, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.1k tokens"}}],
      [-361.4, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.2k tokens"}}],
      [-360.4, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.3k tokens"}}],
      [-359.4, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.4k tokens"}}],
      [-358.4, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.5k tokens"}}],
      [-357.4, {"context": "4% · 37.1k", "spin": {"verb": "Orbiting", "tail": "↓ 1.6k tokens"}}],
      [-356.4, {"context": "4% · 38k", "spin": {"verb": "Orbiting", "tail": "↓ 1.8k tokens"}}],
      [-355.4, {"context": "4% · 38k", "spin": {"verb": "Orbiting", "tail": "↓ 1.9k tokens"}}],
      [-355.4, {"context": "4% · 38k", "spin": {"verb": "Orbiting", "tail": "↓ 1.9k tokens · thinking with medium effort"}}],
      [-353.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.0k tokens · thinking with medium effort"}}],
      [-352.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.2k tokens · thought for 1s"}}],
      [-352.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.3k tokens · thought for 1s"}}],
      [-351.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.4k tokens · thought for 1s"}}],
      [-350.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.4k tokens"}}],
      [-350.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.5k tokens"}}],
      [-349.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.6k tokens"}}],
      [-347.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.7k tokens"}}],
      [-344.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.9k tokens"}}],
      [-339.4, {"context": "4% · 39k", "spin": {"verb": "Orbiting", "tail": "↓ 2.9k tokens · thinking with medium effort"}}],
      [-331.4, {"context": "4% · 40.4k", "spin": {"verb": "Orbiting", "tail": "↓ 3.0k tokens · thought for 7s"}}],
      [-331.4, {"context": "4% · 40.4k"}],
      [-22.4, {"context": "4% · 40.4k", "style": "hold:Plain"}],
      [-0.4, {"context": "4% · 40.4k", "style": "hold:Plain", "spin": {"verb": "Scampering"}}],
      [1.6, {"context": "4% · 40.4k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "thinking with medium effort"}}],
      [6.6, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 175 tokens · thought for 4s"}}],
      [6.6, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 338 tokens · thought for 4s"}}],
      [7.6, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 450 tokens"}}],
      [8.6, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 460 tokens"}}],
      [8.6, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 464 tokens · thinking with medium effort"}}],
      [9.6, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 527 tokens · thinking with medium effort"}}],
      [10.6, {"context": "5% · 50.5k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 714 tokens · thinking with medium effort"}}],
      [11.6, {"context": "5% · 50.5k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 783 tokens · thought for 1s"}}],
      [11.6, {"context": "5% · 50.5k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 846 tokens · thought for 1s"}}],
      [12.6, {"context": "5% · 50.5k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 879 tokens · thought for 1s"}}],
      [47.6, {"context": "5% · 50.5k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 966 tokens"}}],
      [48.6, {"context": "5% · 50.5k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 966 tokens · thinking with medium effort"}}],
      [50.6, {"context": "5% · 50.5k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.0k tokens · thinking with medium effort"}}],
      [50.6, {"context": "5% · 51.2k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.2k tokens · thought for 1s"}}],
      [51.6, {"context": "5% · 51.2k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.3k tokens · thought for 1s"}}],
      [52.6, {"context": "5% · 51.2k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.4k tokens · thought for 1s"}}],
      [52.6, {"context": "5% · 51.2k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.4k tokens"}}],
      [53.6, {"context": "5% · 51.2k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.5k tokens"}}],
      [78.6, {"context": "5% · 51.2k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.6k tokens"}}],
      [79.6, {"context": "5% · 51.2k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.6k tokens · thinking with medium effort"}}],
      [80.6, {"context": "5% · 52k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.8k tokens · thinking with medium effort"}}],
      [81.6, {"context": "5% · 52k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.9k tokens · thought for 1s"}}],
      [82.6, {"context": "5% · 52k", "style": "hold:Plain", "spin": {"verb": "Orchestrating", "tail": "↓ 1.9k tokens · thinking with medium effort"}}],
      [91.6, {"context": "5% · 52k", "style": "hold:Plain"}],
      [92.6, {"context": "5% · 52.8k", "style": "hold:Plain"}],
    ],
    reply: [
      "- Return 200 only after the batch row's INSERT commits.",
      "- Add a foreign key on `package_id`, so posts for unknown packages get 404.",
      "- Use `(package_id, batch_id)` as the conflict key; a resent batch counts as already stored.",
      "- Order batches by a database sequence, not `received_at`.",
      "- Save `packages.keys` and mark batches folded in one transaction, under the lock.",
      "- After each fold, recheck for unfolded batches and fold again if any remain.",
      "- Also run the compactor on a timer, so batches skipped under the lock get folded.",
      "- Delete batch rows once they are folded.",
      "- Remove the in-process combining from `src/webhook.js` in the same change.",
      "- Next: add batch rows to the `db.js` stand-in, then test 40 posts through two webhook instances sharing one database.",
    ],
    keys: [
      [
        -1.7,
        "type",
        "/hope:shape"
      ],
      [
        -0.1,
        "key",
        "Enter"
      ],
      [
        29.2,
        "key",
        "Down"
      ],
      [
        37.7,
        "key",
        "Down"
      ],
      [
        46.2,
        "key",
        "Up"
      ],
      [
        47.2,
        "key",
        "Enter"
      ],
      [
        68.7,
        "key",
        "Down"
      ],
      [
        77.1,
        "key",
        "Up"
      ],
      [
        78.2,
        "key",
        "Enter"
      ]
    ],
    menu: {
      "after": 0,
      "rows": [
        [
          [
            "  "
          ],
          [
            "❯ /",
            "l"
          ],
          [
            "hope:shape",
            "l b"
          ],
          [
            "                     (hope) Decide the technical path once the",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "ask is clear. Use when the WHAT is confir…",
            "l"
          ]
        ],
        [
          [
            "  "
          ],
          [
            "  /hope:deepen                    (hope) Hold an ask to the bar a top",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "professional in its field would set — a d…",
            "g"
          ]
        ]
      ]
    },
  },
];
