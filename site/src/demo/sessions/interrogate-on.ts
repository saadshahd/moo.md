import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:interrogate I've settled how callgate works, it's in docs/plan.md: a fast judge model checks every tool call before it runs and blocks the slow-for-no-reason ones once. Build it.",
    tools: "Listed 2 directories, called 2 tools, ran 2 shell commands",
    activity: [
      {"at": 3.0, "line": "Listing repo files and read plan and sources", "tool": "$ git ls-files && cat docs/plan.md && cat package.json && for f in $(git ls-files src test bin 2>/dev/null); do echo \"=== $f\"; cat $f; done; ls -a"},
      {"at": 6.0, "line": "Listing repo files and read plan and sources", "tool": "$ cat README.md dev/judge-stub.js .gitignore; echo ===; head -50 data/slow-calls.csv; wc -l data/*; echo ===; head -5 data/judge-trials.jsonl; ls -la .claude"},
      {"at": 8.0, "line": "Reading data files", "tool": "$ head -50 data/slow-calls.csv; wc -l data/*; echo; head -5 data/judge-trials.jsonl; ls -la .claude"},
      {"at": 11.0, "line": "Reading data files", "tool": "$ tail -3 data/judge-trials.jsonl; git log --stat | head -30"},
      {"at": 62.0, "line": "Strongest case for plan.md: one model covers all 7 slow-call kinds with no rule pile, and block-once keeps a wrong block cheap. But data/judge-trials.jsonl shows the judge flipping on the same call: \\`grep -rn retryAfter ~\\` went block/allow/block; \\`npm test\\` after a one-file diff went allow/block/allow; \\`sleep 300 && cat out/run.log\\` was allowed both times, though the log already ends in EXIT 0. A gate that blocks the same call at random teaches agents to just repeat it. What makes the judge the right decider?", "tool": "$ tail -3 data/judge-trials.jsonl; git log --stat | head -30"},
    ],
    dialogs: [
      {
        "at": [
          28.9,
          61.6
        ],
        "after": 4,
        "tool": "$ tail -3 data/judge-trials.jsonl; git log --stat | head -30",
        "questions": [
          {
            "header": "Judge model",
            "question": "Strongest case for plan.md: one model covers all 7 slow-call kinds with no rule pile, and block-once keeps a wrong block cheap. But data/judge-trials.jsonl shows the judge flipping on the same call: `grep -rn retryAfter ~` went block/allow/block; `npm test` after a one-file diff went allow/block/allow; `sleep 300 && cat out/run.log` was allowed both times, though the log already ends in EXIT 0. A gate that blocks the same call at random teaches agents to just repeat it. What makes the judge the right decider?",
            "multiSelect": false,
            "options": [
              {
                "label": "Rules first, judge after",
                "description": "Fixed checks catch the top kinds (wide grep, full suite, sleep on done log) the same way every time; the judge only sees calls no rule matches.",
                "preview": "hook.js\n  call -> rules.js  match? -> block once (fixed reason + faster way)\n                 no match -> judge.js -> allow | block once\n\nrules.js: ~/ or / search root, npm test with 1-file diff,\n          sleep N && cat <log already ending EXIT>"
              },
              {
                "label": "Judge only, fix the judge",
                "description": "Keep plan.md as written; the trials came from a judge setup that will change (prompt, temperature, context) before this ships.",
                "preview": "hook.js\n  call + context -> judge.js -> allow | block once\n\n(the flip-flopping is the judge team's problem,\n not the gate's)"
              },
              {
                "label": "Rules only, drop the judge",
                "description": "Cover the listed kinds with fixed checks; no network call, well under 100 ms, same answer every time. Kinds no rule covers pass.",
                "preview": "hook.js\n  call -> rules.js  match? -> block once\n                 no match -> allow\n\n(judge.js deleted)"
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
          75.6,
          98.4
        ],
        "after": 5,
        "tool": "$ tail -3 data/judge-trials.jsonl; git log --stat | head -30",
        "left": true,
        "questions": [
          {
            "header": "Ship bar",
            "question": "You chose judge-only, with the judge team fixing the flip-flops. Fixed how — what number? In the trials, the same call got the same verdict 1 time in 3 for grep and npm test. What must the judge hit before callgate turns on?",
            "multiSelect": false,
            "options": [
              {
                "label": "Same verdict 10/10",
                "description": "Each data/slow-calls.csv example, run 10 times, gets the expected verdict every time; a test in this repo checks it against the judge.",
                "preview": "test/judge-agreement.test.js\n  for each row of slow-calls.csv:\n    10 x judge(example) -> all 'block'\n  plus 10 known-fine calls -> all 'allow'\nfails -> callgate stays off"
              },
              {
                "label": "Ship now, bar later",
                "description": "Build and turn on against today's judge; block-once caps the harm of a wrong block to one retry.",
                "preview": "no gate on judge quality;\nwrong block = agent repeats the call once"
              }
            ],
            "picked": []
          },
          {
            "header": "Judge fails",
            "question": "The hook runs before every call with a 100 ms budget, and the judge alone takes ~40 ms plus network. When the judge is slow (past ~80 ms), down, or answers garbage, what does the hook do?",
            "multiSelect": false,
            "options": [
              {
                "label": "Allow, log to stderr",
                "description": "Fail open: the call runs; the hook writes one line to stderr naming the failure so it is visible.",
                "preview": "judge timeout/error -> exit 0\nstderr: callgate: judge timed out (80 ms), allowed"
              },
              {
                "label": "Block",
                "description": "Fail closed: the call is blocked with the error; the agent repeats it to override via block-once.",
                "preview": "judge timeout/error -> exit 2\nstderr: callgate: judge unreachable; repeat to run"
              }
            ],
            "picked": []
          },
          {
            "header": "Context",
            "question": "The sleep trial was allowed because the judge can't see that out/run.log already ends in EXIT 0, and the npm test trial needs the diff. The hook only gets the call and a transcript path. What context does the hook send?",
            "multiSelect": false,
            "options": [
              {
                "label": "Last few transcript turns",
                "description": "Send the last N transcript entries; cheap to read, but holds no file state or diff unless the agent printed them.",
                "preview": "context = last 5 entries of transcript_path\n(no git, no file reads)"
              },
              {
                "label": "Transcript + git diff names",
                "description": "Add `git diff --name-only` (a few ms); still blind to whether a log is done.",
                "preview": "context = last 5 transcript entries\n        + git diff --name-only"
              },
              {
                "label": "Call only",
                "description": "Send the call alone; the judge decides from the command text.",
                "preview": "context = \"\""
              }
            ],
            "picked": []
          }
        ]
      }
    ],
    replyAt: 98.4,
    chrome: [
      [-3.0, {"context": "0%", "style": "hold:Plain"}],
      [-1.0, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Computing"}}],
      [2.0, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 50 tokens"}}],
      [3.0, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 207 tokens"}}],
      [3.0, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 221 tokens"}}],
      [4.0, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 229 tokens"}}],
      [6.0, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 255 tokens"}}],
      [7.0, {"context": "4% · 39.4k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 383 tokens"}}],
      [8.0, {"context": "4% · 39.4k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 394 tokens"}}],
      [8.0, {"context": "4% · 39.4k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 420 tokens"}}],
      [9.0, {"context": "4% · 40.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 521 tokens"}}],
      [10.0, {"context": "4% · 40.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 530 tokens"}}],
      [11.0, {"context": "4% · 40.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 595 tokens"}}],
      [11.0, {"context": "4% · 41.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 641 tokens"}}],
      [12.0, {"context": "4% · 41.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 653 tokens"}}],
      [22.0, {"context": "4% · 41.1k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 1.5k tokens"}}],
      [23.0, {"context": "4% · 41.7k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 1.5k tokens"}}],
      [24.0, {"context": "4% · 41.7k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 1.6k tokens"}}],
      [26.0, {"context": "4% · 41.7k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 1.7k tokens"}}],
      [27.0, {"context": "4% · 41.7k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 1.8k tokens"}}],
      [62.0, {"context": "4% · 41.7k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 2.2k tokens"}}],
      [67.0, {"context": "4% · 43.6k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 2.4k tokens"}}],
      [67.0, {"context": "4% · 43.6k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 2.6k tokens"}}],
      [68.0, {"context": "4% · 43.6k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 2.7k tokens"}}],
      [69.0, {"context": "4% · 43.6k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 2.8k tokens"}}],
      [70.0, {"context": "4% · 43.6k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 2.9k tokens"}}],
      [72.0, {"context": "4% · 43.6k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 3.0k tokens"}}],
      [73.0, {"context": "4% · 43.6k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 3.1k tokens"}}],
      [75.0, {"context": "4% · 43.6k", "style": "hold:Plain", "spin": {"verb": "Frolicking", "tail": "↓ 3.2k tokens"}}],
      [98.0, {"context": "4% · 43.6k", "style": "hold:Plain"}],
    ],
    reply: [
    ],
    keys: [
      [
        -2.6,
        "type",
        "/hope:interrogate I've settled how callgate works, it's in docs/plan.md: a fast judge model checks every tool call before it runs and blocks the slow-for-no-reason ones once. Build it."
      ],
      [
        -0.7,
        "key",
        "Enter"
      ],
      [
        60.7,
        "key",
        "Down"
      ],
      [
        61.6,
        "key",
        "Enter"
      ]
    ],
  },
];
