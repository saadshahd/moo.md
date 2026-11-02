import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:draft what ship prints when a failed check blocks a deploy. Today it only says \"deploy blocked\", and people ask in chat which check failed.",
    tools: "Called 5 tools, ran 3 shell commands",
    activity: [
      {"at": 3.4, "line": "Listing repo files and recent commit history", "tool": "$ ls -la && git log --stat -3 && ls .codegraph 2>/dev/null; find . -type f -not -path './.git/*' -not -path './node_modules/*' | head -100"},
      {"at": 7.4, "line": "Listing repo files and recent commit history", "tool": "$ for f in README.md .gitignore package.json bin/ship.js .ship/last-run.json src/checks.js src/deploy.js; do echo \"=== $f\"; cat -n \"$f\"; done; node --version"},
      {"at": 82.4, "line": "Adding the formatter, wire it in, running it on real and edge-case data", "tool": "$ cat >> src/checks.js <<'EOF'\n\n// What to print when the run's failed checks block a deploy.\nexport function blockedMessage(run) {\n  const failed = run.checks.filter((c) => c.status === \"failed\");\n  const indent = (text) => text.split(\"\\n\").map((line) => `    ${line}`);\n  return [\n    `deploy blocked: ${failed.length} of ${run.checks.length} checks failed` +\n      ` on ${run.commit.slice(0, 7)} (${run.branch})`,\n    ...failed.flatMap((c) => [\n      \"\",\n      `  ${c.name}`,\n      ...(c.error ? indent(c.error) : []),\n      ...indent(c.url),\n    ]),\n    \"\",\n    `full run: ${run.url}`,\n  ].join(\"\\n\");\n}\nEOF\nsed -i '' 's|import { lastRun } from \"../src/checks.js\";|import { blockedMessage, lastRun } from \"../src/checks.js\";|; s|  console.error(\"deploy blocked\");|  console.error(blockedMessage(run));|' bin/ship.js\ngit diff\necho \"=== real run\"; node bin/ship.js deploy staging; echo \"exit $?\"\necho \"=== two failures, one without error, one multi-line\"\nnode --input-type=module -e '\nimport { blockedMessage } from \"./src/checks.js\";\nconsole.log(blockedMessage({\n  commit: \"abcdef1234567890\", branch: \"feat/x\", url: \"https://ci.example.test/runs/9\",\n  checks: [\n    { name: \"build\", status: \"passed\", url: \"u1\" },\n    { name: \"lint\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/2\" },\n    { name: \"unit tests\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/3\",\n      error: \"expected 3, got 4\\n  at cart.test.js:12\" },\n  ],\n}));' | cat -A | head -30"},
      {"at": 83.4, "line": "Adding the formatter, wire it in, running it on real and edge-case data", "tool": "$ for f in README.md .gitignore package.json bin/ship.js .ship/last-run.json src/checks.js src/deploy.js; do echo \"=== $f\"; cat -n \"$f\"; done; node --version"},
      {"at": 87.4, "line": "Adding the formatter, wire it in, running it on real and edge-case data", "tool": "$ node --input-type=module -e '\nimport { blockedMessage } from \"./src/checks.js\";\nconsole.log(blockedMessage({\n  commit: \"abcdef1234567890\", branch: \"feat/x\", url: \"https://ci.example.test/runs/9\",\n  checks: [\n    { name: \"build\", status: \"passed\", url: \"u1\" },\n    { name: \"lint\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/2\" },\n    { name: \"unit tests\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/3\",\n      error: \"expected 3, got 4\\n  at cart.test.js:12\" },\n  ],\n}));' | cat -vet; node bin/ship.js deploy staging 2>&1 >/dev/null | awk '{ if (length > 80) print \"LONG: \" $0 }'; git status --short"},
      {"at": 244.4, "line": "When ship blocks a deploy, should the message also show skipped checks? In the last CI run, \"e2e checkout\" was skipped alongside the failed \"migrations dry-run\".", "tool": "$ node --input-type=module -e '\nimport { blockedMessage } from \"./src/checks.js\";\nconsole.log(blockedMessage({\n  commit: \"abcdef1234567890\", branch: \"feat/x\", url: \"https://ci.example.test/runs/9\",\n  checks: [\n    { name: \"build\", status: \"passed\", url: \"u1\" },\n    { name: \"lint\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/2\" },\n    { name: \"unit tests\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/3\",\n      error: \"expected 3, got 4\\n  at cart.test.js:12\" },\n  ],\n}));' | cat -vet; node bin/ship.js deploy staging 2>&1 >/dev/null | awk '{ if (length > 80) print \"LONG: \" $0 }'; git status --short"},
      {"at": 274.4, "line": "Applying the first-useful-line rule and rerunning all cases", "tool": "$ cat > src/checks.js <<'EOF'\nimport { readFileSync } from \"node:fs\";\n\n// The CI run for the commit being deployed. Each check:\n// { name, status: \"passed\" | \"failed\" | \"skipped\", url, seconds, error? }\nexport function lastRun() {\n  return JSON.parse(readFileSync(new URL(\"../.ship/last-run.json\", import.meta.url)));\n}\n\n// What to print when the run's failed checks block a deploy.\nexport function blockedMessage(run) {\n  const failed = run.checks.filter((c) => c.status === \"failed\");\n  return [\n    `deploy blocked: ${failed.length} of ${run.checks.length} checks failed` +\n      ` on ${run.commit.slice(0, 7)} (${run.branch})`,\n    ...failed.flatMap((c) => {\n      const what = firstMessageLine(c.error ?? \"\");\n      return [\"\", `  ${c.name}`, ...(what ? [`    ${what}`] : []), `    ${c.url}`];\n    }),\n    \"\",\n    `full run: ${run.url}`,\n  ].join(\"\\n\");\n}\n\n// The first line of an error that is neither blank nor a stack frame (\"at ...\").\nfunction firstMessageLine(error) {\n  return error\n    .split(\"\\n\")\n    .map((line) => line.trim())\n    .find((line) => line !== \"\" && !line.startsWith(\"at \"));\n}\nEOF\necho \"=== real run\"; node bin/ship.js deploy staging; echo \"exit $?\"\necho \"=== edge cases\"\nnode --input-type=module -e '\nimport { blockedMessage } from \"./src/checks.js\";\nconst f = (name, error) => ({ name, status: \"failed\", url: `https://ci.example.test/runs/9/${name}`, error });\nconsole.log(blockedMessage({\n  commit: \"abcdef1234567890\", branch: \"feat/x\", url: \"https://ci.example.test/runs/9\",\n  checks: [\n    { name: \"build\", status: \"passed\", url: \"u1\" },\n    f(\"no-error\"),\n    f(\"multi-line\", \"expected 3, got 4\\n    at cart.test.js:12\"),\n    f(\"blank-first\", \"\\n   \\nTimeout after 30s\"),\n    f(\"frame-first\", \"    at Object.<anonymous> (x.js:1:1)\\nTypeError: cart is undefined\"),\n    f(\"frames-only\", \"    at a (x.js:1)\\n    at b (y.js:2)\"),\n  ],\n}));' | cat -vet\nnode bin/ship.js deploy staging 2>&1 | awk \"length > 80 { print \\\"LONG: \\\" \\$0 }\"; awk \"length > 80 { print FILENAME\\\": \\\"FNR }\" src/checks.js bin/ship.js\ngit diff --stat"},
      {"at": 275.4, "line": "Applying the first-useful-line rule and rerunning all cases", "tool": "$ node --input-type=module -e '\nimport { blockedMessage } from \"./src/checks.js\";\nconsole.log(blockedMessage({\n  commit: \"abcdef1234567890\", branch: \"feat/x\", url: \"https://ci.example.test/runs/9\",\n  checks: [\n    { name: \"build\", status: \"passed\", url: \"u1\" },\n    { name: \"lint\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/2\" },\n    { name: \"unit tests\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/3\",\n      error: \"expected 3, got 4\\n  at cart.test.js:12\" },\n  ],\n}));' | cat -vet; node bin/ship.js deploy staging 2>&1 >/dev/null | awk '{ if (length > 80) print \"LONG: \" $0 }'; git status --short"},
      {"at": 280.4, "line": "Wrap two long source lines and recheck output", "tool": "$ python3 - <<'EOF'\np = \"src/checks.js\"\ns = open(p).read()\ns = s.replace('''      return [\"\", `  ${c.name}`, ...(what ? [`    ${what}`] : []), `    ${c.url}`];''',\n'''      return [\n        \"\",\n        `  ${c.name}`,\n        ...(what ? [`    ${what}`] : []),\n        `    ${c.url}`,\n      ];''')\ns = s.replace('''// The first line of an error that is neither blank nor a stack frame (\"at ...\").''',\n'''// The first error line that is neither blank nor a stack frame (\"at ...\").''')\nopen(p, \"w\").write(s)\nEOF\nawk 'length > 80 { print FILENAME\": \"FNR }' src/checks.js; node bin/ship.js deploy staging; echo \"exit $?\"; git diff"},
      {"at": 281.4, "line": "Wrap two long source lines and recheck output", "tool": "$ node --input-type=module -e '\nimport { blockedMessage } from \"./src/checks.js\";\nconsole.log(blockedMessage({\n  commit: \"abcdef1234567890\", branch: \"feat/x\", url: \"https://ci.example.test/runs/9\",\n  checks: [\n    { name: \"build\", status: \"passed\", url: \"u1\" },\n    { name: \"lint\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/2\" },\n    { name: \"unit tests\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/3\",\n      error: \"expected 3, got 4\\n  at cart.test.js:12\" },\n  ],\n}));' | cat -vet; node bin/ship.js deploy staging 2>&1 >/dev/null | awk '{ if (length > 80) print \"LONG: \" $0 }'; git status --short"},
      {"at": 326.4, "line": "Tighten the stack-frame test and rerun every case", "tool": "$ python3 - <<'EOF'\np = \"src/checks.js\"\ns = open(p).read()\ns = s.replace('''// The first error line that is neither blank nor a stack frame (\"at ...\").''',\n'''// The first error line that is neither blank nor a stack frame\n// (\"at <somewhere>:<line>\").''')\ns = s.replace('''    .find((line) => line !== \"\" && !line.startsWith(\"at \"));''',\n'''    .find((line) => line !== \"\" && !/^at .+:\\\\d+/.test(line));''')\nopen(p, \"w\").write(s)\nEOF\nsed -n '29,36p' src/checks.js\necho \"=== real run\"; node bin/ship.js deploy staging; echo \"exit $?\"\necho \"=== edge cases\"\nnode --input-type=module -e '\nimport { blockedMessage } from \"./src/checks.js\";\nconst f = (name, error) => ({ name, status: \"failed\", url: `https://ci.example.test/runs/9/${name}`, error });\nconsole.log(blockedMessage({\n  commit: \"abcdef1234567890\", branch: \"feat/x\", url: \"https://ci.example.test/runs/9\",\n  checks: [\n    f(\"no-error\"),\n    f(\"multi-line\", \"expected 3, got 4\\n    at cart.test.js:12\"),\n    f(\"blank-first\", \"\\n   \\nTimeout after 30s\"),\n    f(\"node-frame-first\", \"    at Object.<anonymous> (x.js:1:1)\\nTypeError: cart is undefined\"),\n    f(\"java-frame-first\", \"\\tat com.shop.Cart(Cart.java:12)\\nNullPointerException: cart\"),\n    f(\"at-least\", \"at least 3 items required\\n    at check (cart.js:4)\"),\n    f(\"at-line\", \"at line 12: unexpected token\"),\n    f(\"frames-only\", \"    at a (x.js:1)\\n    at b (y.js:2)\"),\n  ],\n}));'"},
      {"at": 327.4, "line": "Tighten the stack-frame test and rerun every case", "tool": "$ node --input-type=module -e '\nimport { blockedMessage } from \"./src/checks.js\";\nconsole.log(blockedMessage({\n  commit: \"abcdef1234567890\", branch: \"feat/x\", url: \"https://ci.example.test/runs/9\",\n  checks: [\n    { name: \"build\", status: \"passed\", url: \"u1\" },\n    { name: \"lint\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/2\" },\n    { name: \"unit tests\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/3\",\n      error: \"expected 3, got 4\\n  at cart.test.js:12\" },\n  ],\n}));' | cat -vet; node bin/ship.js deploy staging 2>&1 >/dev/null | awk '{ if (length > 80) print \"LONG: \" $0 }'; git status --short"},
    ],
    dialogs: [
      {
        "at": [
          110.0,
          244.1
        ],
        "after": 5,
        "tool": "$ node --input-type=module -e '\nimport { blockedMessage } from \"./src/checks.js\";\nconsole.log(blockedMessage({\n  commit: \"abcdef1234567890\", branch: \"feat/x\", url: \"https://ci.example.test/runs/9\",\n  checks: [\n    { name: \"build\", status: \"passed\", url: \"u1\" },\n    { name: \"lint\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/2\" },\n    { name: \"unit tests\", status: \"failed\", url: \"https://ci.example.test/runs/9/jobs/3\",\n      error: \"expected 3, got 4\\n  at cart.test.js:12\" },\n  ],\n}));' | cat -vet; node bin/ship.js deploy staging 2>&1 >/dev/null | awk '{ if (length > 80) print \"LONG: \" $0 }'; git status --short",
        "questions": [
          {
            "header": "Skipped",
            "question": "When ship blocks a deploy, should the message also show skipped checks? In the last CI run, \"e2e checkout\" was skipped alongside the failed \"migrations dry-run\".",
            "multiSelect": false,
            "options": [
              {
                "label": "Failed only (Recommended)",
                "description": "What the draft prints now. Skipped checks don't block, so it leaves them out.",
                "preview": "deploy blocked: 1 of 6 checks failed on 8f3c2a9 (main)\n\n  migrations dry-run\n    column \"region\" of relation \"orders\" already exists\n    https://ci.example.test/runs/4812/jobs/4\n\nfull run: https://ci.example.test/runs/4812"
              },
              {
                "label": "Name skipped checks",
                "description": "One extra line naming each skipped check, so readers can tell whether e2e ran.",
                "preview": "deploy blocked: 1 of 6 checks failed on 8f3c2a9 (main)\n\n  migrations dry-run\n    column \"region\" of relation \"orders\" already exists\n    https://ci.example.test/runs/4812/jobs/4\n\nskipped: e2e checkout\nfull run: https://ci.example.test/runs/4812"
              },
              {
                "label": "List skipped like failed",
                "description": "Skipped checks get a full entry with a status word and a link.",
                "preview": "deploy blocked: 1 of 6 checks failed on 8f3c2a9 (main)\n\n  migrations dry-run: failed\n    column \"region\" of relation \"orders\" already exists\n    https://ci.example.test/runs/4812/jobs/4\n\n  e2e checkout: skipped\n    https://ci.example.test/runs/4812/jobs/5\n\nfull run: https://ci.example.test/runs/4812"
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "Error text",
            "question": "How much of a failed check's error text should the blocked message print? The preview uses a made-up run where the unit tests error spans two lines.",
            "multiSelect": false,
            "options": [
              {
                "label": "Full error (Recommended)",
                "description": "What the draft prints now. Every line, indented. Long stack traces would print in full.",
                "preview": "deploy blocked: 2 of 3 checks failed on abcdef1 (feat/x)\n\n  lint\n    https://ci.example.test/runs/9/jobs/2\n\n  unit tests\n    expected 3, got 4\n      at cart.test.js:12\n    https://ci.example.test/runs/9/jobs/3\n\nfull run: https://ci.example.test/runs/9"
              },
              {
                "label": "First line only",
                "description": "Keeps the block short when errors carry stack traces. The link has the rest.",
                "preview": "deploy blocked: 2 of 3 checks failed on abcdef1 (feat/x)\n\n  lint\n    https://ci.example.test/runs/9/jobs/2\n\n  unit tests\n    expected 3, got 4\n    https://ci.example.test/runs/9/jobs/3\n\nfull run: https://ci.example.test/runs/9"
              },
              {
                "label": "No error text",
                "description": "Check names and links only. Readers click through for the error.",
                "preview": "deploy blocked: 2 of 3 checks failed on abcdef1 (feat/x)\n\n  lint\n    https://ci.example.test/runs/9/jobs/2\n\n  unit tests\n    https://ci.example.test/runs/9/jobs/3\n\nfull run: https://ci.example.test/runs/9"
              }
            ],
            "picked": [
              1
            ],
            "notes": "First line only, unless that line is blank or just a stack frame. Then take the first line that says what went wrong."
          },
          {
            "header": "Links",
            "question": "Which CI links should the blocked message print?",
            "multiSelect": false,
            "options": [
              {
                "label": "Each check + run (Recommended)",
                "description": "What the draft prints now. One click to the failed job's log.",
                "preview": "deploy blocked: 1 of 6 checks failed on 8f3c2a9 (main)\n\n  migrations dry-run\n    column \"region\" of relation \"orders\" already exists\n    https://ci.example.test/runs/4812/jobs/4\n\nfull run: https://ci.example.test/runs/4812"
              },
              {
                "label": "Run link only",
                "description": "Shorter. Readers find the failed job on the run page.",
                "preview": "deploy blocked: 1 of 6 checks failed on 8f3c2a9 (main)\n\n  migrations dry-run\n    column \"region\" of relation \"orders\" already exists\n\nfull run: https://ci.example.test/runs/4812"
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 348.5,
    chrome: [
      [-5.6, {"context": "0%", "style": "hold:Plain"}],
      [-0.6, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Photosynthesizing"}}],
      [2.4, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "thinking with xhigh effort"}}],
      [3.4, {"context": "3% · 34.9k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 143 tokens · thinking with xhigh effort"}}],
      [3.4, {"context": "3% · 34.9k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 206 tokens"}}],
      [4.4, {"context": "3% · 34.9k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 224 tokens · thought for 1s"}}],
      [5.4, {"context": "3% · 34.9k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 230 tokens · thought for 1s"}}],
      [6.4, {"context": "3% · 34.9k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 230 tokens"}}],
      [7.4, {"context": "3% · 34.9k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 327 tokens"}}],
      [8.4, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 377 tokens"}}],
      [8.4, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 387 tokens"}}],
      [9.4, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 388 tokens · thinking with xhigh effort"}}],
      [19.4, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 388 tokens · still thinking with xhigh effort"}}],
      [29.4, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 388 tokens · thinking more with xhigh effort"}}],
      [32.4, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 2.6k tokens · thought for 24s"}}],
      [33.4, {"context": "4% · 37.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 2.6k tokens · thought for 24s"}}],
      [34.4, {"context": "4% · 37.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 2.6k tokens"}}],
      [65.4, {"context": "4% · 37.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 2.6k tokens · thinking with xhigh effort"}}],
      [75.4, {"context": "4% · 37.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 2.6k tokens · still thinking with xhigh effort"}}],
      [77.4, {"context": "4% · 37.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 4.0k tokens · thought for 12s"}}],
      [78.4, {"context": "4% · 37.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 4.1k tokens"}}],
      [80.4, {"context": "4% · 37.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 4.2k tokens"}}],
      [81.4, {"context": "4% · 37.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 4.3k tokens"}}],
      [82.4, {"context": "4% · 37.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 4.9k tokens"}}],
      [83.4, {"context": "4% · 40.4k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 4.9k tokens"}}],
      [86.4, {"context": "4% · 40.4k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 5.0k tokens"}}],
      [86.4, {"context": "4% · 40.4k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 5.1k tokens"}}],
      [87.4, {"context": "4% · 43.4k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 5.2k tokens"}}],
      [88.4, {"context": "4% · 43.4k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 5.3k tokens"}}],
      [89.4, {"context": "4% · 43.4k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 5.3k tokens · thinking with xhigh effort"}}],
      [99.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 6.3k tokens · thought for 10s"}}],
      [100.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 6.4k tokens · thought for 10s"}}],
      [101.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 6.4k tokens"}}],
      [102.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 6.5k tokens"}}],
      [103.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 6.6k tokens"}}],
      [104.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 6.7k tokens"}}],
      [105.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 6.8k tokens"}}],
      [106.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 6.9k tokens"}}],
      [107.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 7.0k tokens"}}],
      [109.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 7.1k tokens"}}],
      [244.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 7.9k tokens"}}],
      [246.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 7.9k tokens · thinking with xhigh effort"}}],
      [256.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 7.9k tokens · still thinking with xhigh effort"}}],
      [266.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 7.9k tokens · thinking more with xhigh effort"}}],
      [267.4, {"context": "4% · 44k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 9.9k tokens · thought for 21s"}}],
      [267.4, {"context": "5% · 47.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 9.9k tokens · thought for 21s"}}],
      [268.4, {"context": "5% · 47.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 10.0k tokens · thought for 21s"}}],
      [269.4, {"context": "5% · 47.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 10.1k tokens"}}],
      [270.4, {"context": "5% · 47.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 10.2k tokens"}}],
      [272.4, {"context": "5% · 47.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 10.3k tokens"}}],
      [273.4, {"context": "5% · 47.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 10.4k tokens"}}],
      [274.4, {"context": "5% · 47.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.0k tokens"}}],
      [276.4, {"context": "5% · 47.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.0k tokens · thinking with xhigh effort"}}],
      [278.4, {"context": "5% · 50.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.2k tokens · thinking with xhigh effort"}}],
      [278.4, {"context": "5% · 50.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.3k tokens · thought for 1s"}}],
      [279.4, {"context": "5% · 50.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.4k tokens · thought for 1s"}}],
      [280.4, {"context": "5% · 50.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.5k tokens · thought for 1s"}}],
      [281.4, {"context": "5% · 50.8k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.5k tokens"}}],
      [282.4, {"context": "5% · 52.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.6k tokens · thinking with xhigh effort"}}],
      [283.4, {"context": "5% · 52.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.7k tokens · thinking with xhigh effort"}}],
      [283.4, {"context": "5% · 52.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.7k tokens · thought for 1s"}}],
      [286.4, {"context": "5% · 52.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.7k tokens"}}],
      [323.4, {"context": "5% · 52.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.8k tokens"}}],
      [324.4, {"context": "5% · 52.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 11.9k tokens"}}],
      [325.4, {"context": "5% · 52.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 12.0k tokens"}}],
      [326.4, {"context": "5% · 52.2k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 12.1k tokens"}}],
      [327.4, {"context": "5% · 53.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 12.2k tokens"}}],
      [328.4, {"context": "5% · 53.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 12.3k tokens"}}],
      [329.4, {"context": "5% · 53.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 12.3k tokens · thinking with xhigh effort"}}],
      [339.4, {"context": "5% · 53.1k", "style": "hold:Plain", "spin": {"verb": "Contemplating", "tail": "↓ 12.3k tokens · still thinking with xhigh effort"}}],
      [348.4, {"context": "5% · 53.1k", "style": "hold:Plain"}],
      [349.4, {"context": "5% · 54.4k", "style": "hold:Plain"}],
    ],
    reply: [
      "Draft built and left uncommitted on `main`, in `bin/ship.js` and `src/checks.js`:",
      "",
      "```",
      "deploy blocked: 1 of 6 checks failed on 8f3c2a9 (main)",
      "",
      "  migrations dry-run",
      "    column \"region\" of relation \"orders\" already exists",
      "    https://ci.example.test/runs/4812/jobs/4",
      "",
      "full run: https://ci.example.test/runs/4812",
      "```",
      "",
      "Tested on the real run: it still exits 1.",
      "Also tested: blank, stack-frame and no-error cases.",
      "",
      "| open choice | picked | pick otherwise if |",
      "|---|---|---|",
      "| what counts as a stack frame | `at <file>:<line>` (Node, Java) | CI runs Python: it starts `Traceback…`, error last |",
      "| error with only frames | print no error line | you want the first frame |",
      "| `1 of 6` count | includes skipped checks | the hidden skipped check confuses readers |",
      "| `deploy blocked` first | kept | nothing searches logs for it |",
      "| plain text, no color | yes | people read it only in a terminal |",
      "| 7-character commit hash | copied in `src/deploy.js` | this ships: share one helper |",
      "",
      "Next: answer the open choices in the card, or mark up the block above.",
    ],
    keys: [
      [
        -5.6,
        "type",
        "/hope:draft what ship prints when a failed check blocks a deploy. Today it only says \"deploy blocked\", and people ask in chat which check failed."
      ],
      [
        -0.9,
        "key",
        "Enter"
      ],
      [
        123.3,
        "key",
        "Down"
      ],
      [
        131.6,
        "key",
        "Down"
      ],
      [
        139.9,
        "key",
        "Down"
      ],
      [
        153.5,
        "key",
        "Up"
      ],
      [
        153.5,
        "key",
        "Up"
      ],
      [
        153.5,
        "key",
        "Up"
      ],
      [
        154.5,
        "key",
        "Enter"
      ],
      [
        167.5,
        "key",
        "Down"
      ],
      [
        175.8,
        "key",
        "Down"
      ],
      [
        184.1,
        "key",
        "Up"
      ],
      [
        185.1,
        "key",
        "n"
      ],
      [
        190.4,
        "type",
        "First line only, unless that line is blank or just a stack frame. Then take the first line that says what went wrong."
      ],
      [
        203.7,
        "key",
        "Enter"
      ],
      [
        217.9,
        "key",
        "Down"
      ],
      [
        226.2,
        "key",
        "Up"
      ],
      [
        227.2,
        "key",
        "Enter"
      ],
      [
        241.7,
        "key",
        "Enter"
      ],
      [
        246.7,
        "key",
        "Enter"
      ]
    ],
  },
];
