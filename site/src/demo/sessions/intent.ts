import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "the agent box is running out of disk space - I dumped df, du and the worktree state into ops/agent-box/. what can we clean safely?",
    tools: "Ran 2 shell commands",
    activity: [
      {"at": 1.9, "line": "Listing and printing snapshot files and bin scripts", "tool": "$ ls -la ops/agent-box/ bin/ && for f in ops/agent-box/*; do echo \"=== $f\"; cat \"$f\"; done; echo; for f in bin/*; do echo \"=== $f\"; cat \"$f\"; done"},
      {"at": 36.9, "line": "Inspecting extra dir and summarizing worktree snapshot", "tool": "$ find ops/agent-box/.claude -type f | head; for f in $(find ops/agent-box/.claude -type f | head -5); do echo \"== $f\"; cat \"$f\"; done; git log --stat | head -30\nawk -F'\\t' 'NR>2{n++; s+=$2; key=($3==0&&$4==0&&$6==\"no\")?\"clean-idle\":($6==\"yes\"?\"running\":\"has-work\"); c[key]++; g[key]+=$2; if($2>3) big[key]+=$2; cnt[$1]++} END{print \"rows\",n,\"sum\",s; for(k in c) printf \"%s n=%d gb=%.1f big=%.1f\\n\",k,c[k],g[k],big[k]; for(p in cnt) if(cnt[p]>1) print \"dup\",p}' ops/agent-box/worktrees.tsv\necho; echo \"small rows (<=1.1) with nonzero work or running:\"; awk -F'\\t' 'NR>2 && $2<=1.1 && ($3>0||$4>0||$6==\"yes\")' ops/agent-box/worktrees.tsv\necho \"big rows clean idle:\"; awk -F'\\t' 'NR>2 && $2>1.1 && $3==0&&$4==0&&$6==\"no\"' ops/agent-box/worktrees.tsv\necho \"has-work rows:\"; awk -F'\\t' 'NR>2 && $6==\"no\" && ($3>0||$4>0)' ops/agent-box/worktrees.tsv | sort -t$'\\t' -k5n"},
    ],
    replyAt: 169.7,
    chrome: [
      [-4.1, {"context": "0%"}],
      [-0.1, {"context": "0%", "spin": {"verb": "Pouncing"}}],
      [0.9, {"context": "0%", "spin": {"verb": "Germinating", "tail": "thinking with medium effort"}}],
      [0.9, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 113 tokens · thinking with medium effort"}}],
      [1.9, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 212 tokens"}}],
      [2.9, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 224 tokens · thought for 1s"}}],
      [3.9, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 230 tokens · thought for 1s"}}],
      [3.9, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 230 tokens · thinking with medium effort"}}],
      [13.9, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 230 tokens · still thinking with medium effort"}}],
      [23.9, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 230 tokens · thinking more with medium effort"}}],
      [31.9, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 2.7k tokens · thought for 28s"}}],
      [32.9, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 2.8k tokens · thought for 28s"}}],
      [34.9, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 2.8k tokens"}}],
      [34.9, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 2.9k tokens"}}],
      [37.9, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 3.5k tokens"}}],
      [38.9, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 3.5k tokens · thinking with medium effort"}}],
      [48.9, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 3.5k tokens · still thinking with medium effort"}}],
      [57.9, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 3.5k tokens · thinking more with medium effort"}}],
      [62.9, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 5.7k tokens · thought for 24s"}}],
      [63.9, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 5.7k tokens · thought for 24s"}}],
      [64.9, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 5.7k tokens"}}],
      [155.9, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 5.7k tokens · thinking with medium effort"}}],
      [162.9, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 5.8k tokens · thought for 7s"}}],
      [163.9, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.4k tokens · thought for 7s"}}],
      [165.9, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.5k tokens"}}],
      [166.9, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.6k tokens"}}],
      [167.9, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.7k tokens"}}],
      [168.9, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.8k tokens"}}],
      [169.9, {"context": "5% · 53k"}],
    ],
    reply: [
      "You can safely free about **315 GB, all from `/data/worktrees`**, without touching models, home, docker or logs. That's plenty: the box is down to 25 GB free and losing about 12 GB a day, so it fills up in about 2 days.",
      "",
      "## What's safe to clean, by priority",
      "",
      "**1. 240 worktrees that are idle and clean: about 200 GB.** These rows show 0 uncommitted files, 0 unpushed commits and no process inside. Each is about 0.6–1.1 GB.",
      "- Remove them with `git worktree remove <path>` (no `--force`), then run `git worktree prune`. Don't use `rm -rf`.",
      "- Their `agent/*` branches live in `/data/product/.git`, so the branches and commits are kept. Don't delete those branches.",
      "",
      "**2. `target/` inside the 26 worktrees that still hold work: about 115 GB.** These have uncommitted files or unpushed commits. `target/` is build output that `cargo build` recreates, so deleting only that folder keeps the work and frees most of the space (about 4–7 GB of the size of each one). Leave the worktrees themselves for their owners to review.",
      "",
      "**Leave alone:** the 7 worktrees with a running process (`b55-hang-472/732`, `cap-fix-283/757`, `chip-u30-596`, `mac-build-847`, `shelf-qa-503`).",
      "",
      "## Re-run the checks live before deleting anything",
      "",
      "Don't delete paths straight from the TSV:",
      "- **It's stale.** It was taken at 08:10, and new runs have started since.",
      "- **Ignored files aren't checked.** `git status --porcelain` skips gitignored files, so a worktree showing \"0 uncommitted\" can still hold agent output. The 12 GB `/data/product/.agent-scratch` suggests agents do write to ignored paths. Count a worktree as clean only if `git status --porcelain --ignored` shows nothing except `target/`.",
      "- **The process check can miss things.** `bin/worktree-report` treats any `lsof` error as \"no process\". It only sees the user's own processes unless it runs as root, and `-d cwd` misses processes that have files open there while their working directory is elsewhere. A live cleanup should skip a worktree when `lsof` fails, and run as root.",
      "- **Two paths appear twice:** `chip-u30-656` and `migrate-db-628`, with different sizes. Skip both until someone checks `git worktree list --porcelain` on the box.",
      "",
      "## Second tier: check each one first",
      "",
      "| Path | Size | Notes |",
      "|---|---|---|",
      "| `/data/tmp/rt-target`, `b55-target`, etc. | 96G | These are just build output, but `b55-target` is probably used by the two running b55-hang runs. Run `lsof +D` on each before deleting. |",
      "| `/data/product/target` | 47G | Build output for the main checkout. Check nothing is building there first. |",
      "| `/data/cache/sccache` | 40G | Lower its size limit (`SCCACHE_CACHE_SIZE`) rather than deleting it. |",
      "| `cargo-registry` / `npm` | 19G / 16G | Safe to clear with `npm cache clean --force`, but clearing the cargo registry breaks builds that are running. |",
      "| `/data/docker` | 66G | Run `docker system df`, then prune. Never `rm` inside this folder. |",
      "| models, home, logs, `.agent-scratch` | — | Leave these to whoever owns them. |",
      "",
      "## Root cause",
      "",
      "`bin/run-agent` never cleans up after a run, and it can't: `exec agent` replaces the shell, so nothing runs after the agent exits. That's 273 worktrees in about 16 days. The fix:",
      "- Drop the `exec` and add an EXIT trap. When the run ends, the trap removes the worktree if it's clean, and otherwise deletes its `target/`.",
      "- The run suffix (`date +%s | tail -c 4`) is only 3 digits, so the same task name repeats a suffix after about 12 runs. That probably explains the duplicate rows.",
      "",
      "One oddity: 240 of the 273 runs have no changes, no commits and no build output. Either something already deletes `target/`, or those runs failed at `cargo build` before the agent started. That's worth checking separately.",
      "",
      "**Next step:** I can write a `bin/` cleanup script that applies these checks live on the box. It would only print what it would remove unless run with `--apply`. I haven't written anything yet. Should I?",
    ],
    keys: [
      [
        -1.6,
        "type",
        "the agent box is running out of disk space - I dumped df, du and the worktree state into ops/agent-box/. what can we clean safely?"
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
  {
    user: "/hope:intent",
    tools: "Called 4 tools",
    dialogs: [
      {
        "at": [
          14.2,
          48.3
        ],
        "after": 0,
        "questions": [
          {
            "header": "Ask",
            "question": "`bin/run-agent` never removes its worktree, so the disk will fill again after any cleanup. Which ask should I build for?",
            "multiSelect": false,
            "options": [
              {
                "label": "Stop the disk filling (Recommended)",
                "description": "Each run cleans up after itself, plus one sweep of the 273 worktrees already there.",
                "preview": "bin/run-agent\n  - exec agent ...\n  + agent ...; on exit:\n  +   clean, nothing unpushed -> git worktree remove\n  +   otherwise                -> delete target/ only\n  + run suffix long enough not to repeat\n\nbin/clean-worktrees   (one-off sweep)\n  dry run by default, --apply to delete\n  rechecks each worktree on the box first"
              },
              {
                "label": "One-off cleanup only",
                "description": "The ask as given: a sweep script for what's there now. The disk fills again in about 3 weeks.",
                "preview": "bin/clean-worktrees\n  dry run by default, --apply to delete\n  clean + idle     -> git worktree remove\n  has work, idle   -> delete target/ only\n  process inside   -> skip\n  lsof error / dup -> skip, report\n\nbin/run-agent: unchanged"
              },
              {
                "label": "No script",
                "description": "Keep the analysis I already gave you; you run the cleanup by hand.",
                "preview": "No new files.\nYou run git worktree remove\nby hand on the box."
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      },
      {
        "at": [
          62.2,
          85.3
        ],
        "after": 0,
        "questions": [
          {
            "header": "Sweep",
            "question": "If an agent gets killed or the box reboots, run-agent's exit cleanup never runs. Should the sweep also run nightly from cron to catch those, or only when you run it by hand?",
            "multiSelect": false,
            "options": [
              {
                "label": "Nightly via cron (Recommended)",
                "description": "Same script. A cron line on the box runs it with --apply each night.",
                "preview": "bin/clean-worktrees   dry run unless --apply\nbin/install-cron      adds one line:\n  0 3 * * *  bin/clean-worktrees --apply \\\n               >> /data/logs/clean-worktrees.log"
              },
              {
                "label": "By hand only",
                "description": "You run it yourself, now and whenever needed. Killed runs pile up until then.",
                "preview": "bin/clean-worktrees   dry run unless --apply\n(no cron)"
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 96.5,
    chrome: [
      [-216.5, {"context": "0%", "spin": {"verb": "Germinating", "tail": "thinking with medium effort"}}],
      [-216.5, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 113 tokens · thinking with medium effort"}}],
      [-215.5, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 212 tokens"}}],
      [-214.5, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 224 tokens · thought for 1s"}}],
      [-213.5, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 230 tokens · thought for 1s"}}],
      [-213.5, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 230 tokens · thinking with medium effort"}}],
      [-203.5, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 230 tokens · still thinking with medium effort"}}],
      [-193.5, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 230 tokens · thinking more with medium effort"}}],
      [-185.5, {"context": "4% · 35.3k", "spin": {"verb": "Germinating", "tail": "↓ 2.7k tokens · thought for 28s"}}],
      [-184.5, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 2.8k tokens · thought for 28s"}}],
      [-182.5, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 2.8k tokens"}}],
      [-182.5, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 2.9k tokens"}}],
      [-179.5, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 3.5k tokens"}}],
      [-178.5, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 3.5k tokens · thinking with medium effort"}}],
      [-168.5, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 3.5k tokens · still thinking with medium effort"}}],
      [-159.5, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 3.5k tokens · thinking more with medium effort"}}],
      [-154.5, {"context": "5% · 45k", "spin": {"verb": "Germinating", "tail": "↓ 5.7k tokens · thought for 24s"}}],
      [-153.5, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 5.7k tokens · thought for 24s"}}],
      [-152.5, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 5.7k tokens"}}],
      [-61.5, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 5.7k tokens · thinking with medium effort"}}],
      [-54.5, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 5.8k tokens · thought for 7s"}}],
      [-53.5, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.4k tokens · thought for 7s"}}],
      [-51.5, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.5k tokens"}}],
      [-50.5, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.6k tokens"}}],
      [-49.5, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.7k tokens"}}],
      [-48.5, {"context": "5% · 49.4k", "spin": {"verb": "Germinating", "tail": "↓ 6.8k tokens"}}],
      [-47.5, {"context": "5% · 53k"}],
      [-15.5, {"context": "5% · 53k", "style": "hold:Plain"}],
      [-0.5, {"context": "5% · 53k", "style": "hold:Plain", "spin": {"verb": "Levitating"}}],
      [0.5, {"context": "5% · 53k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "thinking with medium effort"}}],
      [3.5, {"context": "5% · 53k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "thought for 3s"}}],
      [4.5, {"context": "6% · 61k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 200 tokens · thought for 3s"}}],
      [4.5, {"context": "6% · 61k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 363 tokens · thought for 3s"}}],
      [5.5, {"context": "6% · 61k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 513 tokens"}}],
      [6.5, {"context": "6% · 61k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 523 tokens · thinking with medium effort"}}],
      [7.5, {"context": "6% · 61k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 528 tokens · thinking with medium effort"}}],
      [9.5, {"context": "6% · 62.3k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 641 tokens · thought for 3s"}}],
      [9.5, {"context": "6% · 62.3k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 828 tokens · thought for 3s"}}],
      [10.5, {"context": "6% · 62.3k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 991 tokens · thought for 3s"}}],
      [11.5, {"context": "6% · 62.3k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 1.1k tokens"}}],
      [13.5, {"context": "6% · 62.3k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 1.2k tokens"}}],
      [48.5, {"context": "6% · 62.3k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 1.4k tokens"}}],
      [48.5, {"context": "6% · 62.3k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 1.4k tokens · thinking with medium effort"}}],
      [49.5, {"context": "6% · 63.4k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 1.5k tokens · thinking with medium effort"}}],
      [50.5, {"context": "6% · 63.4k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 1.7k tokens · thinking with medium effort"}}],
      [51.5, {"context": "6% · 63.4k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 1.7k tokens · thought for 1s"}}],
      [51.5, {"context": "6% · 63.4k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 1.7k tokens · thinking with medium effort"}}],
      [59.5, {"context": "6% · 63.4k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 2.3k tokens · thought for 7s"}}],
      [59.5, {"context": "6% · 64.6k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 2.4k tokens · thought for 7s"}}],
      [61.5, {"context": "6% · 64.6k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 2.5k tokens"}}],
      [85.5, {"context": "6% · 64.6k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 2.7k tokens"}}],
      [86.5, {"context": "6% · 64.6k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 2.7k tokens · thinking with medium effort"}}],
      [94.5, {"context": "6% · 64.6k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 2.7k tokens · thought for 8s"}}],
      [95.5, {"context": "7% · 65.7k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 3.5k tokens · thought for 8s"}}],
      [95.5, {"context": "7% · 65.7k", "style": "hold:Plain", "spin": {"verb": "Tempering", "tail": "↓ 3.6k tokens · thought for 8s"}}],
      [96.5, {"context": "7% · 65.7k", "style": "hold:Plain"}],
    ],
    reply: [
      "Work order: stop `/data` filling up.",
      "Each run cleans up after itself.",
      "A nightly sweep catches what's left.",
      "",
      "| Piece | What it does |",
      "|---|---|",
      "| `bin/run-agent` | Runs the agent without `exec`; on exit, cleans the worktree using the safety check below |",
      "| `bin/clean-worktrees` | Checks every worktree live on the box; prints only, unless run with `--apply` |",
      "| `bin/install-cron` | Adds a nightly 03:00 `clean-worktrees --apply` job |",
      "| log | `/data/logs/clean-worktrees.log` |",
      "| run name | Gets a suffix that can't repeat (the 3-digit one does) |",
      "",
      "```",
      "safety check — one function shared by run-agent and clean-worktrees, per worktree:",
      "  if a process has its cwd inside, or lsof errors -> skip",
      "  if the path is listed twice in git              -> skip, report it",
      "  if files changed (ignored ones too, not target/)",
      "     or commits are not on origin/main            -> delete target/ only",
      "  else                                            -> git worktree remove",
      "```",
      "",
      "| Must NOT | Why |",
      "|---|---|",
      "| `rm -rf` a worktree or `--force` a remove | git keeps track of the worktree and files go unchecked |",
      "| delete `agent/*` branches | the commits live on those branches |",
      "| read paths from the TSV | the snapshot is old; the box has changed |",
      "",
      "| Bar | How it's met |",
      "|---|---|",
      "| start from | live `git worktree list --porcelain`, not the TSV |",
      "| method | shellcheck, plus test repos in `$TMPDIR` set up in each state |",
      "| aim | daily free space on `/data` stops falling once runs clean up |",
      "| right if | first dry run shows ≈ 240 remove |",
      "| right if | first dry run shows 26 `target/` only |",
      "| right if | first dry run shows 7 skip |",
      "| right if | `agent/*` branch count is the same before and after `--apply` |",
      "",
      "Assumption: `/data/logs` already exists on the box and is writable by whoever owns the cron job.",
      "",
      "Next: I write and test the three scripts here. Then you copy them to the box and do a dry run first.",
    ],
    keys: [
      [
        -1.7,
        "type",
        "/hope:intent"
      ],
      [
        -0.2,
        "key",
        "Enter"
      ],
      [
        29.7,
        "key",
        "Down"
      ],
      [
        38.1,
        "key",
        "Down"
      ],
      [
        46.6,
        "key",
        "Up"
      ],
      [
        47.3,
        "key",
        "Up"
      ],
      [
        48.3,
        "key",
        "Enter"
      ],
      [
        75.8,
        "key",
        "Down"
      ],
      [
        84.2,
        "key",
        "Up"
      ],
      [
        85.3,
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
            "hope:intent",
            "l b"
          ],
          [
            "                    (hope) Turn a rough ask into a clear work",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "order. Use when the ask is rough, unspoke…",
            "l"
          ]
        ],
        [
          [
            "  "
          ],
          [
            "  /hope:inversion                 (hope) Find the route to guaranteed",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "failure, negate it. Use when a goal keeps…",
            "g"
          ]
        ]
      ]
    },
  },
];
