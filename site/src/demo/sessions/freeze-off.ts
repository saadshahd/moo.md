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
];
