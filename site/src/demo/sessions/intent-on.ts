import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:intent the agent box is running out of disk space - I dumped df, du and the worktree state into ops/agent-box/. what can we clean safely?",
    tools: "Listed 1 directory, called 3 tools, ran 4 shell commands",
    activity: [
      {"at": 2.4, "line": "Listing and read box snapshots and scripts", "tool": "$ ls -la ops/agent-box/ bin/ && for f in ops/agent-box/*; do echo \"=== $f\"; cat \"$f\"; done; echo; for f in bin/*; do echo \"=== $f\"; cat \"$f\"; done; cat .gitignore 2>/dev/null; ls .codegraph 2>/dev/null"},
      {"at": 20.4, "line": "Reading hidden snapshot dir and truncated rows", "tool": "$ find ops/agent-box/.claude -type f | head; for f in $(find ops/agent-box/.claude -type f); do echo \"=== $f\"; cat \"$f\"; done; echo; sed -n 70,140p ops/agent-box/worktrees.tsv; git log --stat | head -30"},
      {"at": 32.4, "line": "Total worktree sizes by safety class", "tool": "$ ls -la ops/agent-box/.claude; awk -F'\\t' 'NR>2{n++; s+=$2; if($3==0&&$4==0&&$6==\"no\"){c++;cs+=$2; if($5>=7){o++;os+=$2}} else {k++;ks+=$2}; if($6==\"\")e++} END{print \"rows\",n,\"sum\",s; print \"clean idle\",c,cs; print \"  of which >=7d\",o,os; print \"keep\",k,ks; print \"blank process col\",e}' ops/agent-box/worktrees.tsv; awk -F'\\t' 'NR>2 && $2>2' ops/agent-box/worktrees.tsv | sort -t$'\\t' -k6,6 -k4,4n; cut -f1 ops/agent-box/worktrees.tsv | sort | uniq -d; awk -F'\\t' 'NR>2 && NF!=6' ops/agent-box/worktrees.tsv"},
      {"at": 41.4, "line": "Checking lsof -a and -d semantics", "tool": "$ man lsof 2>/dev/null | col -b | grep -n -A12 -E '^\\s+-a\\s|^\\s+-d s' | head -60"},
      {"at": 43.4, "line": "Checking lsof -a and -d semantics", "tool": "$ man lsof 2>/dev/null | col -b | sed -n 212,240p; man lsof | col -b | grep -n -B2 -A8 'ORed' | head -50"},
      {"at": 65.4, "line": "Listing **1** directory, calling **1** tool, running **4** shell commands…", "tool": "$ man lsof 2>/dev/null | col -b | sed -n 212,240p; man lsof | col -b | grep -n -B2 -A8 'ORed' | head -50"},
      {"at": 70.4, "line": "Listing **1** directory, calling **2** tools, running **4** shell commands…", "tool": "$ man lsof 2>/dev/null | col -b | sed -n 212,240p; man lsof | col -b | grep -n -B2 -A8 'ORed' | head -50"},
      {"at": 1172.4, "line": "Box free space fell ~12G/day (212G→25G in 16 days) because bin/run-agent never removes a worktree. Deleting the 240 clean, pushed, idle worktrees frees ~200G, which lasts ~17 days. Which job do you want?", "tool": "$ man lsof 2>/dev/null | col -b | sed -n 212,240p; man lsof | col -b | grep -n -B2 -A8 'ORed' | head -50"},
      {"at": 1175.4, "line": "Listing **1** directory, calling **3** tools, running **4** shell commands…", "tool": "$ man lsof 2>/dev/null | col -b | sed -n 212,240p; man lsof | col -b | grep -n -B2 -A8 'ORed' | head -50"},
    ],
    launches: [
      {"at": 64.938, "skill": "hope:reframe"},
      {"at": 1175.434, "skill": "hope:deepen"},
    ],
    dialogs: [
      {
        "at": [
          75.0,
          1171.8
        ],
        "after": 7,
        "tool": "$ man lsof 2>/dev/null | col -b | sed -n 212,240p; man lsof | col -b | grep -n -B2 -A8 'ORed' | head -50",
        "questions": [
          {
            "header": "Scope",
            "question": "Box free space fell ~12G/day (212G→25G in 16 days) because bin/run-agent never removes a worktree. Deleting the 240 clean, pushed, idle worktrees frees ~200G, which lasts ~17 days. Which job do you want?",
            "multiSelect": false,
            "options": [
              {
                "label": "Cleanup + stop growth (Recommended)",
                "description": "One-off sweep script for the box now, plus run-agent removes its own worktree when the run leaves nothing unsaved.",
                "preview": "bin/sweep-worktrees   (run on box now)\n  rechecks each worktree live:\n  clean + pushed + no process → git worktree remove\n\nbin/run-agent         (change)\n  on exit: same check → remove own worktree\n  else: leave it, print why"
              },
              {
                "label": "One-off cleanup only",
                "description": "Just the sweep script to run on the box now; growth resumes at ~12G/day.",
                "preview": "bin/sweep-worktrees   (run on box now)\n  rechecks each worktree live:\n  clean + pushed + no process → git worktree remove"
              },
              {
                "label": "Just the list",
                "description": "No scripts: a ranked list of what is safe to delete and what needs an owner's call.",
                "preview": "| tier | what | frees |\n| safe | 240 idle worktrees | ~200G |\n| owner | /data/tmp targets | ~96G |\n| ..."
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 1200.3,
    chrome: [
      [-2.6, {"context": "0%", "style": "hold:Plain"}],
      [-0.6, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Quantumizing"}}],
      [0.4, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "thinking with medium effort"}}],
      [1.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 113 tokens · thinking with medium effort"}}],
      [1.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 210 tokens · thinking with medium effort"}}],
      [2.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 235 tokens · thought for 1s"}}],
      [3.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 244 tokens · thought for 1s"}}],
      [4.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 244 tokens · thinking with medium effort"}}],
      [14.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 244 tokens · still thinking with medium effort"}}],
      [19.4, {"context": "4% · 44.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 1.6k tokens · thought for 16s"}}],
      [21.4, {"context": "4% · 44.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 1.8k tokens"}}],
      [22.4, {"context": "4% · 44.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 1.9k tokens · thinking with medium effort"}}],
      [28.4, {"context": "5% · 48.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 2.5k tokens · thought for 7s"}}],
      [29.4, {"context": "5% · 48.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 2.6k tokens · thought for 7s"}}],
      [30.4, {"context": "5% · 48.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 2.6k tokens"}}],
      [32.4, {"context": "5% · 48.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 2.8k tokens"}}],
      [32.4, {"context": "5% · 48.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 2.9k tokens · thinking with medium effort"}}],
      [33.4, {"context": "5% · 48.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 3.0k tokens · thinking with medium effort"}}],
      [40.4, {"context": "5% · 48.6k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 3.7k tokens · thought for 8s"}}],
      [41.4, {"context": "5% · 50.8k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 3.7k tokens · thought for 8s"}}],
      [42.4, {"context": "5% · 50.8k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 3.8k tokens · thought for 8s"}}],
      [42.4, {"context": "5% · 50.8k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 3.8k tokens"}}],
      [43.4, {"context": "5% · 50.8k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 3.9k tokens"}}],
      [44.4, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 4.0k tokens"}}],
      [45.4, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 4.0k tokens · thinking with medium effort"}}],
      [55.4, {"context": "5% · 52.3k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 4.0k tokens · still thinking with medium effort"}}],
      [63.4, {"context": "5% · 53.8k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 5.6k tokens · thought for 19s"}}],
      [64.4, {"context": "5% · 53.8k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 5.7k tokens · thought for 19s"}}],
      [65.4, {"context": "5% · 53.8k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 5.9k tokens · thought for 19s"}}],
      [65.4, {"context": "5% · 53.8k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 6.0k tokens · thinking with medium effort"}}],
      [70.4, {"context": "6% · 56.5k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 6.1k tokens · thought for 4s"}}],
      [70.4, {"context": "6% · 56.5k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 6.3k tokens · thought for 4s"}}],
      [71.4, {"context": "6% · 56.5k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 6.5k tokens"}}],
      [73.4, {"context": "6% · 56.5k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 6.6k tokens"}}],
      [74.4, {"context": "6% · 56.5k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 6.7k tokens"}}],
      [1172.4, {"context": "6% · 56.5k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 6.9k tokens"}}],
      [1172.4, {"context": "6% · 56.5k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 6.9k tokens · thinking with medium effort"}}],
      [1173.4, {"context": "6% · 57.7k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 7.0k tokens · thinking with medium effort"}}],
      [1174.4, {"context": "6% · 57.7k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 7.2k tokens · thinking with medium effort"}}],
      [1174.4, {"context": "6% · 57.7k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 7.2k tokens · thought for 1s"}}],
      [1176.4, {"context": "6% · 57.7k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 7.2k tokens · thinking with medium effort"}}],
      [1186.4, {"context": "6% · 57.7k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 7.2k tokens · still thinking with medium effort"}}],
      [1195.4, {"context": "6% · 57.7k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 7.2k tokens · thinking more with medium effort"}}],
      [1199.4, {"context": "6% · 58.9k", "style": "hold:Plain", "spin": {"verb": "Gesticulating", "tail": "↓ 8.5k tokens · thought for 23s"}}],
      [1200.4, {"context": "6% · 58.9k", "style": "hold:Plain", "band": ["questions 1"]}],
    ],
    panes: {
      "questions": {
        chips: [],
        body: [
          [{"id": "title", "label": "questions", "kind": "title"}, {"id": "close", "label": "close", "kind": "line"}],
          [],
          [{"id": "question:0", "label": "• Fix the 3-digit run name clash next?", "kind": "title"}],
          [{"id": "answer:0:0", "label": "◦ yes", "kind": "line", "indent": 2}],
          [{"id": "answer:0:1", "label": "◦ later", "kind": "line", "indent": 2}],
        ],
      },
    },
    reply: [
      "Next: I write `bin/sweep-worktrees` and change `bin/run-agent`.",
      "",
      "| what | frees | verdict |",
      "|---|---|---|",
      "| 240 worktrees: clean, pushed, nothing running | ~200G | safe, after a fresh check on the box |",
      "| 26 idle worktrees with unsaved work | — | keep the work; their `target/` dirs can go |",
      "| 7 worktrees with a live process | — | keep |",
      "| `/data/tmp/*-target` (96G), `/data/product/target` (47G) | — | no known owner: ask before deleting |",
      "| sccache, cargo, npm caches | 75G | rebuildable, but builds get slower |",
      "| models, home, docker, logs | — | the owner's call |",
      "",
      "The numbers are two days old. The disk loses 6–12G a day, so it may already be nearly full.",
      "",
      "| step | rule |",
      "|---|---|",
      "| `bin/sweep-worktrees` | dry run by default; `--apply` deletes |",
      "| fetch | runs first, then checks each worktree on the box |",
      "| removal | `git worktree remove` without `--force` |",
      "| commits | none lost: agent branches stay |",
      "| running-process check | runs as root via `/proc/*/cwd` and `/proc/*/fd`; current `lsof` check sees only cwd |",
      "| `bin/run-agent` | removes its own worktree when nothing is unsaved |",
      "| `bin/run-agent` | `exec agent` must go, or no cleanup runs |",
      "| success | `df` after the sweep matches the dry-run total |",
      "| success | free space stays level in next week's history |",
      "| must NOT | touch dirty, unpushed or in-use worktrees |",
      "| must NOT | touch anything outside `/data/worktrees` |",
      "",
      "Separate issue: run names end in only 3 digits, so two runs of the same task can clash.",
      "Want that fixed next?",
      "",
      "Next: you run the sweep on the box, dry run first, then `--apply`.",
    ],
    keys: [
      [
        -2.0,
        "type",
        "/hope:intent the agent box is running out of disk space - I dumped df, du and the worktree state into ops/agent-box/. what can we clean safely?"
      ],
      [
        -0.1,
        "key",
        "Enter"
      ],
      [
        1171.8,
        "key",
        "Enter"
      ]
    ],
  },
];
