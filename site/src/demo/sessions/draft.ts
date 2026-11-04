import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "Change what ship prints when a failed check blocks a deploy. Today it only says \"deploy blocked\", and people ask in chat which check failed.",
    tools: "Edited 1 file +10 -4, ran 3 shell commands",
    activity: [
      {"at": 1.3, "line": "Listing repo files and finding the blocked message", "tool": "$ git ls-files && ls -a && grep -rn \"deploy blocked\" . --exclude-dir=.git"},
      {"at": 4.3, "line": "Listing repo files and finding the blocked message", "tool": "$ for f in bin/ship.js src/checks.js src/deploy.js package.json README.md .gitignore .ship/last-run.json; do echo \"=== $f\"; cat -n $f; done; ls .claude"},
      {"at": 13.3, "line": "Running ship against failing, multi-failing, and passing CI data", "tool": "$ node bin/ship.js deploy staging; echo \"exit=$?\"\n# no-error, multi-failure, and all-passing variants against a temp copy\ncp .ship/last-run.json \"$TMPDIR/orig.json\"\nnode -e 'const f=\".ship/last-run.json\",r=JSON.parse(require(\"fs\").readFileSync(f));r.checks[0].status=\"failed\";require(\"fs\").writeFileSync(f,JSON.stringify(r))'\nnode bin/ship.js deploy staging; echo \"exit=$?\"\nnode -e 'const f=\".ship/last-run.json\",r=JSON.parse(require(\"fs\").readFileSync(f));r.checks.forEach(c=>c.status=\"passed\");require(\"fs\").writeFileSync(f,JSON.stringify(r))'\nnode bin/ship.js deploy staging; echo \"exit=$?\"\ncp \"$TMPDIR/orig.json\" .ship/last-run.json && git status --short"},
    ],
    replyAt: 18.8,
    chrome: [
      [-2.7, {"context": "0%"}],
      [-0.7, {"context": "0%", "spin": {"verb": "Osmosing"}}],
      [1.3, {"context": "0%", "spin": {"verb": "Scampering"}}],
      [1.3, {"context": "0%", "spin": {"verb": "Scampering", "tail": "↓ 28 tokens"}}],
      [2.3, {"context": "4% · 35.1k", "spin": {"verb": "Scampering", "tail": "↓ 107 tokens"}}],
      [3.3, {"context": "4% · 35.1k", "spin": {"verb": "Scampering", "tail": "↓ 118 tokens"}}],
      [4.3, {"context": "4% · 35.1k", "spin": {"verb": "Scampering", "tail": "↓ 167 tokens"}}],
      [4.3, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 253 tokens"}}],
      [5.3, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 270 tokens · thinking with medium effort"}}],
      [6.3, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 275 tokens · thinking with medium effort"}}],
      [7.3, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 313 tokens · thought for 3s"}}],
      [8.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 475 tokens · thought for 3s"}}],
      [9.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 647 tokens · thought for 3s"}}],
      [9.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 685 tokens"}}],
      [10.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 734 tokens"}}],
      [11.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 766 tokens"}}],
      [12.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 842 tokens"}}],
      [12.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 887 tokens"}}],
      [13.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 968 tokens"}}],
      [14.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 1.2k tokens · thinking with medium effort"}}],
      [18.3, {"context": "4% · 36.6k"}],
      [19.3, {"context": "4% · 37.9k"}],
    ],
    reply: [
      "When a deploy is blocked, ship now prints which checks failed, the error each one reported, and a link to its CI job. I ran it against the current CI data and this is the output:",
      "",
      "```",
      "deploy blocked: 1 check failed on 8f3c2a9",
      "  ✗ migrations dry-run: column \"region\" of relation \"orders\" already exists",
      "    https://ci.example.test/runs/4812/jobs/4",
      "```",
      "",
      "The change is in `bin/ship.js:13` and is the only file changed.",
      "",
      "I also ran it against edited copies of the CI data for two more cases, then put the original file back:",
      "- **Two failed checks:** the header says \"2 checks failed\" and lists both. A check with no error message shows just its name and link.",
      "- **All checks passing:** the deploy goes ahead and exits with 0, same as before.",
      "",
      "The exit code stays 1 when a check fails, so scripts that rely on it won't break.",
      "",
      "Decision for you: **skipped checks aren't shown.** The current data has \"e2e checkout\" marked skipped, and since skipped checks don't block a deploy I left them out. If you'd rather warn about them so a skipped checkout test doesn't go unnoticed, that's a one-line addition.",
      "",
      "The project has no tests yet, so I didn't add one for this.",
    ],
    keys: [
      [
        -2.1,
        "type",
        "Change what ship prints when a failed check blocks a deploy. Today it only says \"deploy blocked\", and people ask in chat which check failed."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
  {
    user: "/hope:draft",
    tools: "Edited 1 file +22 -10, called 2 tools, ran 1 shell command",
    activity: [
      {"at": 762.9, "line": "Running ship on real, noisy-error, and passing CI data", "tool": "$ cp .ship/last-run.json \"$TMPDIR/orig.json\"\nnode bin/ship.js deploy staging; echo \"exit=$?\"; echo ---\nnode -e 'const f=\".ship/last-run.json\",fs=require(\"fs\"),r=JSON.parse(fs.readFileSync(f));r.checks[0].status=\"failed\";r.checks[0].error=\"\\n    at build (x.js:1)\\nTypeError: x is undefined\\n    at y (z.js:2)\";r.checks[1].status=\"failed\";r.checks[1].error=\"   \\n   at only (frame.js:1)\";r.checks[4].status=\"passed\";fs.writeFileSync(f,JSON.stringify(r))'\nnode bin/ship.js deploy staging; echo \"exit=$?\"; echo ---\nnode -e 'const f=\".ship/last-run.json\",fs=require(\"fs\"),r=JSON.parse(fs.readFileSync(f));r.checks.forEach(c=>c.status=\"passed\");fs.writeFileSync(f,JSON.stringify(r))'\nnode bin/ship.js deploy staging; echo \"exit=$?\"\ncp \"$TMPDIR/orig.json\" .ship/last-run.json && git status --short"},
      {"at": 843.9, "line": "I count only JavaScript lines that start with \"at \" as stack frames. A Python error would print \"Traceback (most recent call last):\" as its reason. Should ship also skip Python traceback lines?", "tool": "$ cp .ship/last-run.json \"$TMPDIR/orig.json\"\nnode bin/ship.js deploy staging; echo \"exit=$?\"; echo ---\nnode -e 'const f=\".ship/last-run.json\",fs=require(\"fs\"),r=JSON.parse(fs.readFileSync(f));r.checks[0].status=\"failed\";r.checks[0].error=\"\\n    at build (x.js:1)\\nTypeError: x is undefined\\n    at y (z.js:2)\";r.checks[1].status=\"failed\";r.checks[1].error=\"   \\n   at only (frame.js:1)\";r.checks[4].status=\"passed\";fs.writeFileSync(f,JSON.stringify(r))'\nnode bin/ship.js deploy staging; echo \"exit=$?\"; echo ---\nnode -e 'const f=\".ship/last-run.json\",fs=require(\"fs\"),r=JSON.parse(fs.readFileSync(f));r.checks.forEach(c=>c.status=\"passed\");fs.writeFileSync(f,JSON.stringify(r))'\nnode bin/ship.js deploy staging; echo \"exit=$?\"\ncp \"$TMPDIR/orig.json\" .ship/last-run.json && git status --short"},
    ],
    dialogs: [
      {
        "at": [
          13.5,
          748.4
        ],
        "after": 0,
        "questions": [
          {
            "header": "Skipped",
            "question": "When a deploy is blocked, should ship also list checks that were skipped? Right now the e2e checkout check is skipped and ship says nothing about it.",
            "multiSelect": false,
            "options": [
              {
                "label": "Leave them out",
                "description": "Current draft. Only failed checks block, so only they print. Pick the other if a skipped check is often the real problem.",
                "preview": "deploy blocked: 1 check failed on 8f3c2a9\n  ✗ migrations dry-run: column \"region\" ...\n    https://ci.example.test/runs/4812/jobs/4"
              },
              {
                "label": "List them after",
                "description": "Adds a note line so no one assumes e2e passed.",
                "preview": "deploy blocked: 1 check failed on 8f3c2a9\n  ✗ migrations dry-run: column \"region\" ...\n    https://ci.example.test/runs/4812/jobs/4\n  skipped: e2e checkout"
              }
            ],
            "picked": [
              1
            ]
          },
          {
            "header": "Error text",
            "question": "Real check errors can be long stack traces. How much of each error should ship print?",
            "multiSelect": false,
            "options": [
              {
                "label": "Whole error",
                "description": "Current draft. Fine while errors are one line, as in the sample data. Pick the other if your CI errors run many lines.",
                "preview": "  ✗ migrations dry-run: column \"region\" of relation\n    \"orders\" already exists\n    at Migrator.run (...)\n    at ...\n    https://ci.example.test/runs/4812/jobs/4"
              },
              {
                "label": "First line only",
                "description": "Keeps output short; the link holds the rest.",
                "preview": "  ✗ migrations dry-run: column \"region\" of relation \"orders\" already exists\n    https://ci.example.test/runs/4812/jobs/4"
              }
            ],
            "picked": [
              1
            ],
            "notes": "First line only, unless that line is blank or just a stack frame. Then take the first line that says what went wrong."
          },
          {
            "header": "Marker",
            "question": "Should failed checks start with the ✗ symbol or with plain ASCII? Some CI logs and Windows terminals show ✗ as junk.",
            "multiSelect": false,
            "options": [
              {
                "label": "✗ symbol",
                "description": "Current draft. Pick ASCII if ship runs inside CI logs or old terminals.",
                "preview": "  ✗ migrations dry-run: ..."
              },
              {
                "label": "ASCII 'FAIL'",
                "description": "Shows the same everywhere.",
                "preview": "  FAIL migrations dry-run: ..."
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "Link",
            "question": "Which link should a failed check show: its own CI job, or the whole CI run?",
            "multiSelect": false,
            "options": [
              {
                "label": "Each check's job",
                "description": "Current draft. Goes straight to the failing log. Pick the run link if people need the full picture first.",
                "preview": "  ✗ migrations dry-run: ...\n    https://ci.example.test/runs/4812/jobs/4"
              },
              {
                "label": "One run link",
                "description": "One link at the bottom for the whole run.",
                "preview": "  ✗ migrations dry-run: ...\nsee https://ci.example.test/runs/4812"
              }
            ],
            "picked": [
              0
            ],
            "notes": "Each job, and the run link once at the end."
          }
        ]
      },
      {
        "at": [
          770.9,
          843.3
        ],
        "after": 1,
        "tool": "$ cp .ship/last-run.json \"$TMPDIR/orig.json\"\nnode bin/ship.js deploy staging; echo \"exit=$?\"; echo ---\nnode -e 'const f=\".ship/last-run.json\",fs=require(\"fs\"),r=JSON.parse(fs.readFileSync(f));r.checks[0].status=\"failed\";r.checks[0].error=\"\\n    at build (x.js:1)\\nTypeError: x is undefined\\n    at y (z.js:2)\";r.checks[1].status=\"failed\";r.checks[1].error=\"   \\n   at only (frame.js:1)\";r.checks[4].status=\"passed\";fs.writeFileSync(f,JSON.stringify(r))'\nnode bin/ship.js deploy staging; echo \"exit=$?\"; echo ---\nnode -e 'const f=\".ship/last-run.json\",fs=require(\"fs\"),r=JSON.parse(fs.readFileSync(f));r.checks.forEach(c=>c.status=\"passed\");fs.writeFileSync(f,JSON.stringify(r))'\nnode bin/ship.js deploy staging; echo \"exit=$?\"\ncp \"$TMPDIR/orig.json\" .ship/last-run.json && git status --short",
        "questions": [
          {
            "header": "Python",
            "question": "I count only JavaScript lines that start with \"at \" as stack frames. A Python error would print \"Traceback (most recent call last):\" as its reason. Should ship also skip Python traceback lines?",
            "multiSelect": false,
            "options": [
              {
                "label": "JS frames only",
                "description": "Current draft. Fine if every check that can fail runs on Node. Pick the other if any check runs Python.",
                "preview": "  ✗ lint: Traceback (most recent call last):\n    https://ci.example.test/runs/4812/jobs/3"
              },
              {
                "label": "Also Python",
                "description": "Skips the Traceback header and the File \"...\" lines. A Python error's message comes last, so ship takes the last line.",
                "preview": "  ✗ lint: KeyError: 'region'\n    https://ci.example.test/runs/4812/jobs/3"
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "No message",
            "question": "If an error has only blank lines and stack frames, what should ship print?",
            "multiSelect": false,
            "options": [
              {
                "label": "Name only",
                "description": "Current draft. The job link has the full error. Pick the other if a bare name looks like a missing error.",
                "preview": "  ✗ unit tests\n    https://ci.example.test/runs/4812/jobs/2"
              },
              {
                "label": "First frame",
                "description": "Shows where the error came from.",
                "preview": "  ✗ unit tests: at only (frame.js:1)\n    https://ci.example.test/runs/4812/jobs/2"
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 849.6,
    chrome: [
      [-58.1, {"context": "0%", "spin": {"verb": "Osmosing"}}],
      [-57.1, {"context": "0%", "spin": {"verb": "Scampering"}}],
      [-57.1, {"context": "0%", "spin": {"verb": "Scampering", "tail": "↓ 28 tokens"}}],
      [-56.1, {"context": "4% · 35.1k", "spin": {"verb": "Scampering", "tail": "↓ 107 tokens"}}],
      [-55.1, {"context": "4% · 35.1k", "spin": {"verb": "Scampering", "tail": "↓ 118 tokens"}}],
      [-54.1, {"context": "4% · 35.1k", "spin": {"verb": "Scampering", "tail": "↓ 167 tokens"}}],
      [-54.1, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 253 tokens"}}],
      [-53.1, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 270 tokens · thinking with medium effort"}}],
      [-52.1, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 275 tokens · thinking with medium effort"}}],
      [-51.1, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 313 tokens · thought for 3s"}}],
      [-50.1, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 475 tokens · thought for 3s"}}],
      [-49.1, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 647 tokens · thought for 3s"}}],
      [-49.1, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 685 tokens"}}],
      [-48.1, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 734 tokens"}}],
      [-47.1, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 766 tokens"}}],
      [-46.1, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 842 tokens"}}],
      [-46.1, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 887 tokens"}}],
      [-45.1, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 968 tokens"}}],
      [-44.1, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 1.2k tokens · thinking with medium effort"}}],
      [-40.1, {"context": "4% · 36.6k"}],
      [-39.1, {"context": "4% · 37.9k"}],
      [-22.1, {"context": "4% · 37.9k", "style": "hold:Plain"}],
      [-0.1, {"context": "4% · 37.9k", "style": "hold:Plain", "spin": {"verb": "Whirlpooling"}}],
      [0.9, {"context": "4% · 37.9k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "thinking with medium effort"}}],
      [4.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 163 tokens · thought for 4s"}}],
      [5.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 325 tokens · thought for 4s"}}],
      [6.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 525 tokens"}}],
      [7.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 625 tokens"}}],
      [7.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 682 tokens"}}],
      [8.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 720 tokens"}}],
      [9.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 800 tokens"}}],
      [9.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 844 tokens"}}],
      [10.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 891 tokens"}}],
      [11.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 954 tokens"}}],
      [12.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 997 tokens"}}],
      [747.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 1.1k tokens"}}],
      [748.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 1.3k tokens"}}],
      [749.9, {"context": "4% · 44.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 1.4k tokens · thinking with medium effort"}}],
      [754.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 1.6k tokens · thought for 5s"}}],
      [754.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 1.8k tokens · thought for 5s"}}],
      [755.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 2.0k tokens"}}],
      [756.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 2.1k tokens"}}],
      [757.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 2.2k tokens"}}],
      [758.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 2.3k tokens"}}],
      [759.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 2.4k tokens"}}],
      [761.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 2.5k tokens"}}],
      [763.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 3.1k tokens"}}],
      [764.9, {"context": "5% · 46.7k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 3.1k tokens · thinking with medium effort"}}],
      [766.9, {"context": "5% · 48.8k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 3.3k tokens · thought for 1s"}}],
      [767.9, {"context": "5% · 48.8k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 3.4k tokens · thought for 1s"}}],
      [768.9, {"context": "5% · 48.8k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 3.5k tokens"}}],
      [769.9, {"context": "5% · 48.8k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 3.6k tokens"}}],
      [842.9, {"context": "5% · 48.8k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 3.7k tokens"}}],
      [843.9, {"context": "5% · 48.8k", "style": "hold:Plain", "spin": {"verb": "Actioning", "tail": "↓ 3.7k tokens · thinking with medium effort"}}],
      [849.9, {"context": "5% · 48.8k", "style": "hold:Plain", "band": ["questions 1"]}],
      [849.9, {"context": "5% · 49.7k", "style": "hold:Plain", "band": ["questions 1"]}],
    ],
    panes: {
      "questions": {
        chips: [],
        body: [
          [{"id": "title", "label": "questions", "kind": "title"}, {"id": "close", "label": "close", "kind": "line"}],
          [],
          [{"id": "question:0", "label": "• Commit the new blocked-deploy message?", "kind": "title"}],
          [{"id": "answer:0:0", "label": "◦ Commit", "kind": "line", "indent": 2}],
          [{"id": "answer:0:1", "label": "◦ Change it first", "kind": "line", "indent": 2}],
        ],
      },
    },
    reply: [
      "The new message is in `bin/ship.js:12-36`.",
      "It is not committed.",
      "",
      "```",
      "deploy blocked: 1 check failed",
      "  ✗ migrations dry-run: column \"region\" of relation \"orders\" already exists",
      "    https://ci.example.test/runs/4812/jobs/4",
      "  skipped: e2e checkout",
      "run: https://ci.example.test/runs/4812",
      "```",
      "",
      "| case tried | result |",
      "|---|---|",
      "| error starts with blank lines and \"at …\" frames | shows the first real line: `TypeError: x is undefined` |",
      "| error that is only blank lines and frames | shows the check name and link, no reason |",
      "| every check passed | deploys, exits 0 |",
      "",
      "Next: read the change in `bin/ship.js` and tell me whether to commit it.",
    ],
    keys: [
      [
        -2.6,
        "type",
        "/hope:draft"
      ],
      [
        -0.1,
        "key",
        "Enter"
      ],
      [
        626.7,
        "key",
        "Down"
      ],
      [
        635.1,
        "key",
        "Down"
      ],
      [
        640.8,
        "key",
        "Up"
      ],
      [
        641.7,
        "key",
        "Enter"
      ],
      [
        656.5,
        "key",
        "Down"
      ],
      [
        664.9,
        "key",
        "n"
      ],
      [
        665.7,
        "type",
        "First line only, unless that line is blank or just a stack frame. Then take the first line that says what went wrong."
      ],
      [
        677.5,
        "key",
        "Enter"
      ],
      [
        691.8,
        "key",
        "Down"
      ],
      [
        700.2,
        "key",
        "Up"
      ],
      [
        701.1,
        "key",
        "Enter"
      ],
      [
        715.6,
        "key",
        "Down"
      ],
      [
        724.1,
        "key",
        "Up"
      ],
      [
        724.9,
        "key",
        "n"
      ],
      [
        725.8,
        "type",
        "Each job, and the run link once at the end."
      ],
      [
        734.4,
        "key",
        "Enter"
      ],
      [
        748.4,
        "key",
        "Enter"
      ],
      [
        797.3,
        "key",
        "Down"
      ],
      [
        805.7,
        "key",
        "Up"
      ],
      [
        806.6,
        "key",
        "Enter"
      ],
      [
        821.0,
        "key",
        "Down"
      ],
      [
        829.4,
        "key",
        "Up"
      ],
      [
        830.3,
        "key",
        "Enter"
      ],
      [
        843.3,
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
            "hope:draft",
            "l b"
          ],
          [
            "                     (hope) Build the thing the user can't",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "specify, choices surfaced. Use when the u…",
            "l"
          ]
        ],
        [
          [
            "  "
          ],
          [
            "  /hope:reframe                   (hope) Restate a problem off the framing",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "it arrived in. Use when a framing came by…",
            "g"
          ]
        ]
      ]
    },
  },
];
