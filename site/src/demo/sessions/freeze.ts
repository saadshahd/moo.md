import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "Freeze the order export before anyone touches it. It stopped sending orders to the warehouse this morning.",
    tools: "Searched for 1 pattern, listed 2 directories, called 1 tool, ran 2 shell commands",
    activity: [
      {"at": 2.5, "line": "Running ls -la && git log --oneline -**5** && git show --stat…", "tool": "$ ls -la && git log --oneline -5 && git show --stat HEAD && ls .codegraph 2>/dev/null"},
      {"at": 4.5, "line": "Running ls -la && git log --oneline -**5** && git show --stat…", "tool": "$ cat README.md .gitignore package.json config/export.json src/export.js; find var .claude -type f | head -50; ls -laR var"},
      {"at": 6.5, "line": "Running ls -la && git log --oneline -**5** && git show --stat…", "tool": "$ cat var/run/export.json var/run/status.json; echo; tail -30 var/log/export.log; wc -l var/queue/pending.jsonl; ls -la .claude; find .claude -type f -exec sh -c 'echo \"== $1\"; cat \"$1\"' _ {} \\;"},
      {"at": 10.5, "line": "Running grep -n -B**2** -A**2** -m**1** \"failed\" var/log/export.log; …", "tool": "$ cat var/run/export.json var/run/status.json; echo; tail -30 var/log/export.log; wc -l var/queue/pending.jsonl; ls -la .claude; find .claude -type f -exec sh -c 'echo \"== $1\"; cat \"$1\"' _ {} \\;"},
      {"at": 12.5, "line": "Running grep -n -B**2** -A**2** -m**1** \"failed\" var/log/export.log; …", "tool": "$ sed -n 1,30p var/log/export.log; head -c 600 var/queue/pending.jsonl; echo; awk '{print length}' var/queue/pending.jsonl | sort -n | uniq -c | tail -5"},
      {"at": 19.5, "line": "Running D=incident/**2026**-**11**-**02**-export-**413** && mkdir -p $D &…", "tool": "$ D=incident/2026-11-02-export-413 && mkdir -p $D && cp -Rp var $D/ && git rev-parse HEAD > $D/HEAD && (cd $D && shasum -a 256 HEAD $(find var -type f | sort) > SHA256SUMS) && chmod -R a-w $D && cat $D/SHA256SUMS && (cd $D && shasum -a 256 -c SHA256SUMS) && diff -r var $D/var && echo IDENTICAL; git status --short"},
    ],
    replyAt: 29.4,
    chrome: [
      [-2.5, {"context": "0%"}],
      [-0.5, {"context": "0%", "spin": {"verb": "Tomfoolering"}}],
      [1.5, {"context": "0%", "spin": {"verb": "Pouncing", "tail": "thinking with medium effort"}}],
      [1.5, {"context": "0%", "spin": {"verb": "Pouncing", "tail": "↓ 75 tokens · thinking with medium effort"}}],
      [2.5, {"context": "4% · 35.1k", "spin": {"verb": "Pouncing", "tail": "↓ 219 tokens"}}],
      [3.5, {"context": "4% · 35.1k", "spin": {"verb": "Pouncing", "tail": "↓ 233 tokens · thought for 1s"}}],
      [3.5, {"context": "4% · 35.1k", "spin": {"verb": "Pouncing", "tail": "↓ 239 tokens · thought for 1s"}}],
      [4.5, {"context": "4% · 35.8k", "spin": {"verb": "Pouncing", "tail": "↓ 325 tokens"}}],
      [5.5, {"context": "4% · 35.8k", "spin": {"verb": "Pouncing", "tail": "↓ 335 tokens"}}],
      [6.5, {"context": "4% · 35.8k", "spin": {"verb": "Pouncing", "tail": "↓ 376 tokens"}}],
      [6.5, {"context": "4% · 37.3k", "spin": {"verb": "Pouncing", "tail": "↓ 441 tokens"}}],
      [7.5, {"context": "4% · 37.3k", "spin": {"verb": "Pouncing", "tail": "↓ 482 tokens · thinking with medium effort"}}],
      [8.5, {"context": "4% · 37.3k", "spin": {"verb": "Pouncing", "tail": "↓ 493 tokens · thinking with medium effort"}}],
      [9.5, {"context": "4% · 39.3k", "spin": {"verb": "Pouncing", "tail": "↓ 606 tokens · thought for 2s"}}],
      [10.5, {"context": "4% · 39.3k", "spin": {"verb": "Pouncing", "tail": "↓ 766 tokens · thought for 2s"}}],
      [11.5, {"context": "4% · 39.3k", "spin": {"verb": "Pouncing", "tail": "↓ 786 tokens · thinking with medium effort"}}],
      [11.5, {"context": "4% · 39.3k", "spin": {"verb": "Pouncing", "tail": "↓ 855 tokens · thinking with medium effort"}}],
      [12.5, {"context": "4% · 39.8k", "spin": {"verb": "Pouncing", "tail": "↓ 1.0k tokens"}}],
      [13.5, {"context": "4% · 39.8k", "spin": {"verb": "Pouncing", "tail": "↓ 1.0k tokens · thought for 1s"}}],
      [14.5, {"context": "4% · 39.8k", "spin": {"verb": "Pouncing", "tail": "↓ 1.0k tokens · thinking with medium effort"}}],
      [17.5, {"context": "4% · 39.8k", "spin": {"verb": "Pouncing", "tail": "↓ 1.1k tokens · thought for 4s"}}],
      [18.5, {"context": "4% · 41.6k", "spin": {"verb": "Pouncing", "tail": "↓ 1.3k tokens · thought for 4s"}}],
      [19.5, {"context": "4% · 41.6k", "spin": {"verb": "Pouncing", "tail": "↓ 1.4k tokens · thought for 4s"}}],
      [19.5, {"context": "4% · 41.6k", "spin": {"verb": "Pouncing", "tail": "↓ 1.6k tokens"}}],
      [20.5, {"context": "4% · 41.6k", "spin": {"verb": "Pouncing", "tail": "↓ 1.6k tokens · thinking with medium effort"}}],
      [29.5, {"context": "4% · 42.5k"}],
    ],
    reply: [
      "I took a read-only snapshot of the export's evidence. I could not stop the job itself, which is still running on `orders-worker-1` and failing every 10 minutes. Nothing here gives me access to that host, so pausing it is up to you or ops.",
      "",
      "**Snapshot.** `incident/2026-11-02-export-413/` holds a copy of `var/` as of 20:51Z: the deployed settings, status, log and queue (916 pending orders). It also records the commit the repo was on (`23921af`) and a checksum for every file. I made it read-only, and the checksums match the live `var/`. I did this because `var/` is overwritten by a sync every minute, so the original evidence would soon be gone. The folder is untracked and not committed. Check it any time with `cd incident/2026-11-02-export-413 && shasum -a 256 -c SHA256SUMS`.",
      "",
      "**What broke.** The last successful send was at 09:20; the 09:30 run left no log line. Every run since 09:40 has been rejected by the warehouse with `413 Payload Too Large`.",
      "",
      "- **Likely cause:** paid orders since 09:31 (starting with `ord_50213`) carry a base64 `thumbnail` image on each line, about 6 KB per order. The very first failure was only 13 orders and 77 KB, so payload size is what fails, not order count.",
      "- **Probably not the cause:** at 09:27 `ops-console` deployed `batch_size` 50 → 200. The 13-order failure would have happened at 50 too. The bigger batch only makes requests larger now that the queue has built up: the current request is 200 orders and 1.2 MB.",
      "- **No orders lost so far:** the code only removes orders from the queue after a successful send, so the failed orders are all still queued.",
      "",
      "**Not done yet:**",
      "- Pausing the job on `orders-worker-1`. It's harmless to the data while it keeps failing, but it adds a log line and an attempt every 10 minutes.",
      "- Finding where the thumbnails come from. Nothing in this repo adds them, so it's an upstream change at about 09:31.",
      "- Finding the warehouse's size limit. I only know it's below 77 KB.",
      "",
      "The likely fix is to remove `thumbnail` before sending, or cap each batch by size rather than count. I haven't touched any code, as you asked.",
    ],
    keys: [
      [
        -2.0,
        "type",
        "Freeze the order export before anyone touches it. It stopped sending orders to the warehouse this morning."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
  {
    user: "/hope:freeze",
    tools: "Called 2 tools, ran 2 shell commands",
    activity: [
      {"at": 10.7, "line": "Running date -u +%FT%TZ && cat var/run/export.json var/ru…", "tool": "$ date -u +%FT%TZ && cat var/run/export.json var/run/status.json && echo && sed -n '21,22p;$p' var/log/export.log && grep -c 'batch ok' var/log/export.log && grep -c 'batch failed' var/log/export.log && grep -c '09:30' var/log/export.log; wc -l < var/queue/pending.jsonl; node -e '\nconst q=require(\"fs\").readFileSync(\"var/queue/pending.jsonl\",\"utf8\").trim().split(\"\\n\").map(JSON.parse);\nconst t=q.filter(o=>o.lines.some(l=>\"thumbnail\" in l));\nconsole.log(\"orders\",q.length,\"withThumb\",t.length,\"first\",q[0].order_id,q[0].paid_at,\"last\",q.at(-1).order_id,q.at(-1).paid_at);\nconst s=q.map(o=>JSON.stringify(o).length).sort((a,b)=>a-b);console.log(\"bytes min\",s[0],\"max\",s.at(-1));\nconsole.log(\"keys\",[...new Set(q.flatMap(o=>o.lines.flatMap(Object.keys)))].join(\",\"));\nconsole.log(\"first200 bytes\",JSON.stringify({orders:q.slice(0,200)}).length);\n'; (cd incident/2026-11-02-export-413 && shasum -a 256 -c SHA256SUMS 2>&1 | tail -4); diff -q var incident/2026-11-02-export-413/var; diff config/export.json <(node -e 'const s=require(\"./var/run/export.json\");delete s.deployed_at;delete s.deployed_by;console.log(JSON.stringify(s,null,2))')"},
      {"at": 15.7, "line": "Running node -e 'const a=require(\"./config/export.json\"),…", "tool": "$ node -e 'const a=require(\"./config/export.json\"),b=require(\"./var/run/export.json\");for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(a[k]!==b[k])console.log(k,a[k],\"->\",b[k])'; date -u +%FT%TZ; stat -f '%Sm %N' -t %FT%T var/run/*.json var/log/export.log var/queue/pending.jsonl"},
      {"at": 36.7, "line": "Calling **2** tools, running **2** shell commands…", "tool": "$ node -e 'const a=require(\"./config/export.json\"),b=require(\"./var/run/export.json\");for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(a[k]!==b[k])console.log(k,a[k],\"->\",b[k])'; date -u +%FT%TZ; stat -f '%Sm %N' -t %FT%T var/run/*.json var/log/export.log var/queue/pending.jsonl"},
    ],
    launches: [
      {"at": 19.085, "skill": "hope:draft"},
      {"at": 36.815, "skill": "hope:judge"},
    ],
    replyAt: 58.2,
    chrome: [
      [-70.3, {"context": "0%", "spin": {"verb": "Tomfoolering"}}],
      [-69.3, {"context": "0%", "spin": {"verb": "Pouncing", "tail": "thinking with medium effort"}}],
      [-69.3, {"context": "0%", "spin": {"verb": "Pouncing", "tail": "↓ 75 tokens · thinking with medium effort"}}],
      [-68.3, {"context": "4% · 35.1k", "spin": {"verb": "Pouncing", "tail": "↓ 219 tokens"}}],
      [-67.3, {"context": "4% · 35.1k", "spin": {"verb": "Pouncing", "tail": "↓ 233 tokens · thought for 1s"}}],
      [-67.3, {"context": "4% · 35.1k", "spin": {"verb": "Pouncing", "tail": "↓ 239 tokens · thought for 1s"}}],
      [-66.3, {"context": "4% · 35.8k", "spin": {"verb": "Pouncing", "tail": "↓ 325 tokens"}}],
      [-65.3, {"context": "4% · 35.8k", "spin": {"verb": "Pouncing", "tail": "↓ 335 tokens"}}],
      [-64.3, {"context": "4% · 35.8k", "spin": {"verb": "Pouncing", "tail": "↓ 376 tokens"}}],
      [-64.3, {"context": "4% · 37.3k", "spin": {"verb": "Pouncing", "tail": "↓ 441 tokens"}}],
      [-63.3, {"context": "4% · 37.3k", "spin": {"verb": "Pouncing", "tail": "↓ 482 tokens · thinking with medium effort"}}],
      [-62.3, {"context": "4% · 37.3k", "spin": {"verb": "Pouncing", "tail": "↓ 493 tokens · thinking with medium effort"}}],
      [-61.3, {"context": "4% · 39.3k", "spin": {"verb": "Pouncing", "tail": "↓ 606 tokens · thought for 2s"}}],
      [-60.3, {"context": "4% · 39.3k", "spin": {"verb": "Pouncing", "tail": "↓ 766 tokens · thought for 2s"}}],
      [-59.3, {"context": "4% · 39.3k", "spin": {"verb": "Pouncing", "tail": "↓ 786 tokens · thinking with medium effort"}}],
      [-59.3, {"context": "4% · 39.3k", "spin": {"verb": "Pouncing", "tail": "↓ 855 tokens · thinking with medium effort"}}],
      [-58.3, {"context": "4% · 39.8k", "spin": {"verb": "Pouncing", "tail": "↓ 1.0k tokens"}}],
      [-57.3, {"context": "4% · 39.8k", "spin": {"verb": "Pouncing", "tail": "↓ 1.0k tokens · thought for 1s"}}],
      [-56.3, {"context": "4% · 39.8k", "spin": {"verb": "Pouncing", "tail": "↓ 1.0k tokens · thinking with medium effort"}}],
      [-53.3, {"context": "4% · 39.8k", "spin": {"verb": "Pouncing", "tail": "↓ 1.1k tokens · thought for 4s"}}],
      [-52.3, {"context": "4% · 41.6k", "spin": {"verb": "Pouncing", "tail": "↓ 1.3k tokens · thought for 4s"}}],
      [-51.3, {"context": "4% · 41.6k", "spin": {"verb": "Pouncing", "tail": "↓ 1.4k tokens · thought for 4s"}}],
      [-51.3, {"context": "4% · 41.6k", "spin": {"verb": "Pouncing", "tail": "↓ 1.6k tokens"}}],
      [-50.3, {"context": "4% · 41.6k", "spin": {"verb": "Pouncing", "tail": "↓ 1.6k tokens · thinking with medium effort"}}],
      [-41.3, {"context": "4% · 42.5k"}],
      [-22.3, {"context": "4% · 42.5k", "style": "hold:Plain"}],
      [-0.3, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Whisking"}}],
      [0.7, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "thinking with medium effort"}}],
      [5.7, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 525 tokens · thought for 5s"}}],
      [6.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 553 tokens · thought for 5s"}}],
      [7.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 619 tokens · thought for 5s"}}],
      [7.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 666 tokens"}}],
      [8.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 722 tokens"}}],
      [9.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 766 tokens"}}],
      [10.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 815 tokens"}}],
      [10.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 824 tokens"}}],
      [11.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 866 tokens"}}],
      [12.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.0k tokens · thinking with medium effort"}}],
      [12.7, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.1k tokens · thinking with medium effort"}}],
      [14.7, {"context": "5% · 51.7k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.2k tokens · thought for 2s"}}],
      [15.7, {"context": "5% · 51.7k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.4k tokens · thought for 2s"}}],
      [15.7, {"context": "5% · 51.7k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.5k tokens · thought for 2s"}}],
      [16.7, {"context": "5% · 51.7k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.5k tokens · thinking with medium effort"}}],
      [17.7, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.7k tokens · thinking with medium effort"}}],
      [18.7, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.7k tokens · thought for 1s"}}],
      [19.7, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.8k tokens · thinking with medium effort"}}],
      [29.7, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.8k tokens · still thinking with medium effort"}}],
      [34.7, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.1k tokens · thought for 15s"}}],
      [35.7, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.2k tokens · thought for 15s"}}],
      [36.7, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.2k tokens"}}],
      [36.7, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.3k tokens"}}],
      [37.7, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.5k tokens · thinking with medium effort"}}],
      [47.7, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.5k tokens · still thinking with medium effort"}}],
      [54.7, {"context": "6% · 55.6k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 4.2k tokens · thought for 17s"}}],
      [54.7, {"context": "6% · 55.6k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 4.8k tokens · thought for 17s"}}],
      [56.7, {"context": "6% · 55.6k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 4.9k tokens"}}],
      [57.7, {"context": "6% · 55.6k", "style": "hold:Plain"}],
    ],
    reply: [
      "The snapshot holds. Every value below was read from disk at 20:53Z or is listed as a gap; none is made up.",
      "",
      "| Observed fact | Where it lives |",
      "|---|---|",
      "| Live `batch_size` is 200 | `var/run/export.json` |",
      "| Repo ships `batch_size` 50 | `config/export.json` |",
      "| `batch_size` was changed by `ops-console` at 09:27 | `var/run/export.json` |",
      "| No other setting differs | `var/run/export.json` |",
      "| Last successful send: 25 orders at 09:20 | `var/log/export.log` |",
      "| No log line for the 09:30 run | `var/log/export.log` |",
      "| Status says `last_ok_at` is 09:30 | `var/run/status.json` |",
      "| First failure at 09:40: HTTP 413 on 13 orders (76,881 bytes) | `var/log/export.log:22` |",
      "| 21 runs succeeded | `var/log/export.log` |",
      "| 68 runs failed | `var/log/export.log` |",
      "| Last run at 20:50: 200 orders (1,223,786 bytes) | `var/log/export.log` |",
      "| Largest batch sent fine: 47 orders | `var/log/export.log` |",
      "| Status: running; last run failed; next run 21:00 | `var/run/status.json` |",
      "| Last sync 20:51:12Z; no newer sync by 20:53 | `var/run/status.json` |",
      "| README says sync runs every minute | `README.md` |",
      "| 916 orders queued | `var/queue/pending.jsonl` |",
      "| All 916 have a `thumbnail` field | `var/queue/pending.jsonl` |",
      "| Each queued order is 4,394–8,100 bytes | `var/queue/pending.jsonl` |",
      "| Incident copy matches the live `var/` file for file | `SHA256SUMS` in the incident folder |",
      "",
      "| Open gap | How to get it |",
      "|---|---|",
      "| Live job state on `orders-worker-1` | On the host, check the job and tail the log |",
      "| The warehouse's request size limit | Ask the warehouse team; testing it means a POST |",
      "| Whether the earlier orders that left the queue had thumbnails | Check the warehouse's copies |",
      "| What started adding `thumbnail` around 09:31 | Check the upstream service's deploys |",
      "| Why ops raised `batch_size` | Ask whoever used `ops-console` at 09:27 |",
      "| What the 09:30 run did | Read the host's own log |",
      "| Why the sync stopped after 20:51:12Z | Check the sync job |",
      "",
      "| Conclusion (not observed) | Rests on |",
      "|---|---|",
      "| The 413 comes from request size, not order count | 13 orders failed; 47 orders sent fine earlier |",
      "| The `batch_size` change did not cause the 09:40 failure | 13 is below both 50 and 200 |",
      "| No orders lost so far | `src/export.js` removes orders from the queue only after a send succeeds |",
      "",
      "Next: lock the snapshot as it is, or fetch the gaps on `orders-worker-1` first.",
    ],
    keys: [
      [
        -2.8,
        "type",
        "/hope:freeze"
      ],
      [
        -0.1,
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
            "hope:freeze",
            "l b"
          ],
          [
            "                    (hope) Freeze outside-the-repo state into",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "one snapshot. Use when the work depends o…",
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
  {
    user: "lock",
    replyAt: 3.0,
    chrome: [
      [-72.8, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "thinking with medium effort"}}],
      [-67.8, {"context": "4% · 42.5k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 525 tokens · thought for 5s"}}],
      [-66.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 553 tokens · thought for 5s"}}],
      [-65.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 619 tokens · thought for 5s"}}],
      [-65.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 666 tokens"}}],
      [-64.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 722 tokens"}}],
      [-63.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 766 tokens"}}],
      [-62.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 815 tokens"}}],
      [-62.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 824 tokens"}}],
      [-61.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 866 tokens"}}],
      [-60.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.0k tokens · thinking with medium effort"}}],
      [-60.8, {"context": "5% · 49.9k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.1k tokens · thinking with medium effort"}}],
      [-58.8, {"context": "5% · 51.7k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.2k tokens · thought for 2s"}}],
      [-57.8, {"context": "5% · 51.7k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.4k tokens · thought for 2s"}}],
      [-57.8, {"context": "5% · 51.7k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.5k tokens · thought for 2s"}}],
      [-56.8, {"context": "5% · 51.7k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.5k tokens · thinking with medium effort"}}],
      [-55.8, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.7k tokens · thinking with medium effort"}}],
      [-54.8, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.7k tokens · thought for 1s"}}],
      [-53.8, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.8k tokens · thinking with medium effort"}}],
      [-43.8, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 1.8k tokens · still thinking with medium effort"}}],
      [-38.8, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.1k tokens · thought for 15s"}}],
      [-37.8, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.2k tokens · thought for 15s"}}],
      [-36.8, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.2k tokens"}}],
      [-36.8, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.3k tokens"}}],
      [-35.8, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.5k tokens · thinking with medium effort"}}],
      [-25.8, {"context": "5% · 53.2k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 3.5k tokens · still thinking with medium effort"}}],
      [-18.8, {"context": "6% · 55.6k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 4.2k tokens · thought for 17s"}}],
      [-18.8, {"context": "6% · 55.6k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 4.8k tokens · thought for 17s"}}],
      [-16.8, {"context": "6% · 55.6k", "style": "hold:Plain", "spin": {"verb": "Spinning", "tail": "↓ 4.9k tokens"}}],
      [-15.8, {"context": "6% · 55.6k", "style": "hold:Plain"}],
      [0.2, {"context": "6% · 55.6k", "style": "hold:Plain", "spin": {"verb": "Swooping"}}],
      [1.2, {"context": "6% · 55.6k", "style": "hold:Plain", "spin": {"verb": "Swooping", "tail": "thinking with medium effort"}}],
      [2.2, {"context": "6% · 57.9k", "style": "hold:Plain"}],
    ],
    reply: [
      "I locked the snapshot with all seven gaps still open.",
      "Run the freeze again to refresh it.",
      "Next: decide the fix:",
      "- Strip `thumbnail` before sending.",
      "- Cap each batch by bytes.",
    ],
    keys: [
      [
        -1.6,
        "type",
        "lock"
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
];
