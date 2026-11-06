import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:router Today's list: review the feat/csv-export and feat/due-dates branches, check the code follows docs/rules.md, build a taskline ls command, and sketch the first design in docs/sync.md.",
    tools: "Ran 4 agents, ran 1 shell command",
    activity: [
      {"at": 4.8, "line": "Listing branches, docs, and source layout", "tool": "$ git branch -a && ls -R docs src test* 2>/dev/null; cat docs/rules.md; cat docs/sync.md 2>/dev/null; cat .gitignore"},
      {"at": 26.8, "line": "Draft first sync design doc", "tool": "$ git branch -a && ls -R docs src test* 2>/dev/null; cat docs/rules.md; cat docs/sync.md 2>/dev/null; cat .gitignore"},
    ],
    replyAt: 30.1,
    chrome: [
      [-2.2, {"context": "0%", "style": "hold:Plain"}],
      [-0.2, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Thinking"}}],
      [0.8, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": ""}}],
      [2.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 113 tokens"}}],
      [3.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 275 tokens"}}],
      [4.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 377 tokens"}}],
      [5.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 386 tokens"}}],
      [5.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 390 tokens"}}],
      [8.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 453 tokens"}}],
      [9.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 653 tokens"}}],
      [10.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 815 tokens"}}],
      [10.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 921 tokens"}}],
      [11.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 953 tokens"}}],
      [12.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.0k tokens"}}],
      [13.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.1k tokens"}}],
      [14.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.2k tokens"}}],
      [16.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.3k tokens"}}],
      [16.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.4k tokens"}}],
      [18.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.5k tokens"}}],
      [19.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.6k tokens"}}],
      [21.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.7k tokens"}}],
      [23.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.8k tokens"}}],
      [23.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 1.9k tokens"}}],
      [26.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 2.0k tokens"}}],
      [26.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Herding", "tail": "↓ 2.9k tokens"}}],
      [29.8, {"context": "4% · 42.9k", "style": "hold:Plain"}],
    ],
    reply: [
      "I've sent all four pieces to agents. None has returned yet, so nothing is verified.",
      "",
      "| piece | status | note |",
      "|---|---|---|",
      "| Review of feat/csv-export against bugs and docs/rules.md | running | |",
      "| Review of feat/due-dates against bugs and docs/rules.md | running | |",
      "| `taskline ls` | running | on new branch feat/ls; also lists rule breaks on main |",
      "| First design in docs/sync.md | running | on new branch docs/sync |",
      "",
      "When each one returns, I'll check its work and report it to you.",
    ],
    keys: [
      [
        -2.0,
        "type",
        "/hope:router Today's list: review the feat/csv-export and feat/due-dates branches, check the code follows docs/rules.md, build a taskline ls command, and sketch the first design in docs/sync.md."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
    more: [
      {
        "tools": "Ran 1 agent, ran 1 shell command",
        "reply": [
          "I checked the csv-export review against the diff, and it holds up. Three pieces are still running.",
          "",
          "| piece | status | note |",
          "|---|---|---|",
          "| feat/csv-export review | verified: not ready to merge | |",
          "| Bug at `src/cli.js:19` | confirmed | fields unescaped; a comma in a title shifts columns |",
          "| Rules 2 and 5 | broken | `export` has no CLI test and no `--json` |",
          "| `save()` at `src/store.js:10` | confirmed | main already breaks rule 3: no temp-file-then-rename write |",
          "| feat/due-dates review, `ls`, sync design | running | |",
          "",
          "Next I'll check the other three as they return."
        ]
      },
      {
        "tools": "Ran 1 agent, ran 1 shell command",
        "reply": [
          "I checked the due-dates review against the code, and it holds up.",
          "The branch breaks rule 4 and should not merge.",
          "",
          "| piece | status | note |",
          "|---|---|---|",
          "| Bug at `src/cli.js:10` | confirmed | `new Date(x).toISOString()` stores a UTC timestamp, not `YYYY-MM-DD` |",
          "| Silent rollover | reported by agent | `2026-02-30` becomes March 2 |",
          "| Test at `test/cli.test.js:20` | confirmed | `startsWith` lets the stored timestamp pass |",
          "| `ls` and the sync design | running | |",
          "",
          "Next I'll check `ls` and the sync design when they return."
        ]
      },
      {
        "tools": "Ran 1 agent, ran 2 shell commands",
        "reply": [
          "I checked `ls` on its branch, and it works. The sync design is still running.",
          "",
          "| piece | status | note |",
          "|---|---|---|",
          "| `taskline ls` on feat/ls | tested | 3 of 3 pass; ran it on a temp board |",
          "| Two formats the agent picked | proposed | prints `no tasks` when empty; `--json` prints only the task list |",
          "| Board env var `KANBO_FILE` | open | may be left from an old name |",
          "",
          "I'll check the sync design when it returns."
        ]
      },
      {
        "tools": "Ran 1 agent, ran 1 shell command",
        "reply": [
          "All four pieces are checked: neither feature branch is ready to merge, `ls` works, and the sync design is ready to read.",
          "",
          "| piece | status | note |",
          "|---|---|---|",
          "| feat/csv-export review | verified: don't merge | titles aren't escaped |",
          "| feat/csv-export review | verified: don't merge | `export` has no test |",
          "| feat/csv-export review | verified: don't merge | `export` has no `--json` |",
          "| feat/due-dates review | verified: don't merge | stores a UTC timestamp, not `YYYY-MM-DD` |",
          "| feat/due-dates review | verified: don't merge | impossible dates roll over |",
          "| Rule check on main | verified | `save()` writes in place, not via temp file and rename (rule 3) |",
          "| `taskline ls` on feat/ls | tested | 3 of 3 pass on a temp board |",
          "| Sync design on docs/sync | proposed | example edit checked by hand |",
          "| Gap in the sync doc | open | says no command lists tasks, but feat/ls adds one |",
          "| Board env var `KANBO_FILE` | open | may be left from an old name |",
          "",
          "The sync design needs task ids changed from numbers to strings. It also needs saves made atomic first.",
          "",
          "Nothing is merged or pushed. `ls` is on feat/ls in `.worktrees/ls`, and the sync design is on docs/sync in `.worktrees/sync`.",
          "",
          "Next: decide whether I merge feat/ls and fix `save()` on main, or send the two reviews to the branch authors."
        ]
      }
    ],
  },
];
