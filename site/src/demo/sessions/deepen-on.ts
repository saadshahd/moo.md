import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:deepen Three rule branches conflict with main now: rule/no-empty-link, rule/max-heading-depth and rule/image-alt. Resolve them, one subagent per branch, each in its own worktree under .worktrees/.",
    tools: "Called 1 tool, ran 2 shell commands",
    activity: [
      {"at": 4.4, "line": "Inspecting branches, rules index, and conflicts", "tool": "$ git branch -a && git log --oneline --graph --all | head -30 && cat src/rules/index.js && ls src/rules test* 2>/dev/null; cat package.json; cat .gitignore 2>/dev/null; for b in rule/no-empty-link rule/max-heading-depth rule/image-alt; do echo \"== $b\"; git log --oneline main..$b; git diff --stat $(git merge-base main $b) $b; git merge-tree --write-tree main $b | tail -5; done"},
      {"at": 9.4, "line": "Inspecting branches, rules index, and conflicts", "tool": "$ git show ad4c735 --stat && git show ad4c735 -- README.md src/cli.js test/rules.test.js src/rules/index.js && git show 12deb7d -- README.md src/cli.js test/rules.test.js src/rules/index.js && cat test/rules.test.js && npm test 2>&1 | tail -5"},
      {"at": 85.4, "line": "Each branch and main bump the rule count 12→13 in README.md, src/cli.js and test/rules.test.js. Git merges those lines cleanly as \"13\", so the result passes no conflict check yet is wrong (should be 14), and the length test fails. Once one branch lands, the other two conflict again on the same lines. How should the count be resolved?", "tool": "$ git show ad4c735 --stat && git show ad4c735 -- README.md src/cli.js test/rules.test.js src/rules/index.js && git show 12deb7d -- README.md src/cli.js test/rules.test.js src/rules/index.js && cat test/rules.test.js && npm test 2>&1 | tail -5"},
    ],
    dialogs: [
      {
        "at": [
          22.2,
          84.7
        ],
        "after": 2,
        "tool": "$ git show ad4c735 --stat && git show ad4c735 -- README.md src/cli.js test/rules.test.js src/rules/index.js && git show 12deb7d -- README.md src/cli.js test/rules.test.js src/rules/index.js && cat test/rules.test.js && npm test 2>&1 | tail -5",
        "questions": [
          {
            "header": "Rule count",
            "question": "Each branch and main bump the rule count 12→13 in README.md, src/cli.js and test/rules.test.js. Git merges those lines cleanly as \"13\", so the result passes no conflict check yet is wrong (should be 14), and the length test fails. Once one branch lands, the other two conflict again on the same lines. How should the count be resolved?",
            "multiSelect": false,
            "options": [
              {
                "label": "Derive it (Recommended)",
                "description": "Each branch sets README/help text to drop the number and the test checks rules.length against the files in src/rules/. Branches stop conflicting with each other.",
                "preview": "README.md:\n- mdcheck ships 13 rules; see `src/rules/`.\n+ mdcheck's rules live in `src/rules/`.\n\ncli.js HELP:\n- against mdcheck's 13 rules\n+ against mdcheck's rules\n\ntest/rules.test.js:\n- assert.equal(rules.length, 13)\n+ every src/rules/*.js but index.js\n+ is listed in rules"
              },
              {
                "label": "Hardcode 14 each",
                "description": "Each branch says 14 against main. Whichever lands second and third needs another fix to 15 and 16."
              },
              {
                "label": "Stack 14/15/16",
                "description": "Fix a landing order; each branch resolves against the one before it. Subagents then run in sequence, not parallel."
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "Merge/rebase",
            "question": "Resolve each branch by merging main into it, or by rebasing it onto main?",
            "multiSelect": false,
            "options": [
              {
                "label": "Merge main in (Recommended)",
                "description": "Keeps branch history; no force-push needed if the branches exist on a remote."
              },
              {
                "label": "Rebase onto main",
                "description": "Linear history; rewrites each branch's single commit."
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 92.9,
    chrome: [
      [-2.6, {"context": "0%", "style": "hold:Plain"}],
      [-0.6, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Photosynthesizing"}}],
      [1.4, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "thinking with medium effort"}}],
      [2.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 163 tokens · thought for 1s"}}],
      [3.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 326 tokens · thought for 1s"}}],
      [4.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 369 tokens · thought for 1s"}}],
      [4.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 381 tokens"}}],
      [5.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 388 tokens"}}],
      [6.4, {"context": "4% · 38.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 399 tokens · thinking with medium effort"}}],
      [7.4, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 487 tokens · thinking with medium effort"}}],
      [8.4, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 661 tokens · thought for 1s"}}],
      [9.4, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 707 tokens · thought for 1s"}}],
      [9.4, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 719 tokens · thinking with medium effort"}}],
      [15.4, {"context": "4% · 40.2k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 1.2k tokens · thought for 6s"}}],
      [16.4, {"context": "4% · 42.9k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 1.2k tokens · thought for 6s"}}],
      [16.4, {"context": "4% · 42.9k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 1.3k tokens · thought for 6s"}}],
      [17.4, {"context": "4% · 42.9k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 1.3k tokens"}}],
      [18.4, {"context": "4% · 42.9k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 1.4k tokens"}}],
      [19.4, {"context": "4% · 42.9k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 1.5k tokens"}}],
      [21.4, {"context": "4% · 42.9k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 1.6k tokens"}}],
      [84.4, {"context": "4% · 42.9k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 1.9k tokens"}}],
      [85.4, {"context": "4% · 42.9k", "style": "hold:Plain", "spin": {"verb": "Transfiguring", "tail": "↓ 1.9k tokens · thinking with medium effort"}}],
      [92.4, {"context": "4% · 42.9k", "style": "hold:Plain"}],
      [93.4, {"context": "4% · 44.4k", "style": "hold:Plain"}],
    ],
    reply: [
      "Bar, as release engineering would set it:",
      "",
      "```",
      "- start from: git merge-tree main <branch> per branch, plus main's diff; the hidden clash is the \"13 rules\" count, which git merges silently",
      "- method: in .worktrees/<name>, merge main into rule/<name>; keep both imports in src/rules/index.js; replace the hardcoded count with a test that every src/rules/*.js except index.js appears in rules",
      "- aim: each branch merges into main with no conflict and passes npm test; the three branches make the same count change, so they never clash on it",
      "- right if: per worktree, npm test passes, and git merge-tree main <branch> reports no conflict; node src/cli.js --help shows no number",
      "```",
      "",
      "One gap stays open: once one branch lands, the other two clash again where each appends to the end of `src/rules/index.js`. Fixing that takes one more merge of main into each.",
      "",
      "Next: start three subagents in parallel, one per branch, each held to this bar.",
    ],
    keys: [
      [
        -2.0,
        "type",
        "/hope:deepen Three rule branches conflict with main now: rule/no-empty-link, rule/max-heading-depth and rule/image-alt. Resolve them, one subagent per branch, each in its own worktree under .worktrees/."
      ],
      [
        -0.2,
        "key",
        "Enter"
      ],
      [
        54.3,
        "key",
        "Enter"
      ],
      [
        78.4,
        "key",
        "Enter"
      ],
      [
        84.6,
        "key",
        "Enter"
      ]
    ],
  },
];
