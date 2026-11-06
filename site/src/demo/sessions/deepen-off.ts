import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "Three rule branches conflict with main now: rule/no-empty-link, rule/max-heading-depth and rule/image-alt. Resolve them, one subagent per branch, each in its own worktree under .worktrees/.",
    tools: "Ran 3 agents, ran 4 shell commands",
    activity: [
      {"at": 2.4, "line": "Inspecting branches, worktrees, and conflicts", "tool": "$ git branch -a && git worktree list && ls -a && cat .gitignore 2>/dev/null; for b in rule/no-empty-link rule/max-heading-depth rule/image-alt; do echo \"== $b\"; git log --oneline main..$b; git merge-tree --write-tree --name-only main $b | tail -n +2; done; cat src/rules/index.js"},
      {"at": 7.4, "line": "Inspecting branches, worktrees, and conflicts", "tool": "$ for b in rule/no-empty-link rule/max-heading-depth rule/image-alt; do echo \"== $b\"; git diff main...$b --stat; git diff main...$b -- src/rules/index.js; done; git show ad4c735 --stat"},
      {"at": 10.4, "line": "Comparing count-related edits on main and a branch", "tool": "$ git show ad4c735 -- README.md src/cli.js test/rules.test.js; git diff main...rule/image-alt -- README.md src/cli.js test/rules.test.js"},
      {"at": 43.4, "line": "Creating worktrees and finding all rule-count mentions", "tool": "$ for n in no-empty-link max-heading-depth image-alt; do git worktree add .worktrees/$n rule/$n; done && git worktree list && grep -rn \"1[234] rules\\|twelve\\|thirteen\" --exclude-dir=node_modules --exclude-dir=.worktrees --exclude-dir=.git ."},
      {"at": 59.4, "line": "Resolving rule/image-alt", "tool": "$ for n in no-empty-link max-heading-depth image-alt; do git worktree add .worktrees/$n rule/$n; done && git worktree list && grep -rn \"1[234] rules\\|twelve\\|thirteen\" --exclude-dir=node_modules --exclude-dir=.worktrees --exclude-dir=.git ."},
    ],
    replyAt: 65.2,
    chrome: [
      [-2.6, {"context": "0%"}],
      [-0.6, {"context": "0%", "spin": {"verb": "Considering"}}],
      [1.4, {"context": "0%", "spin": {"verb": "Sautéing", "tail": ""}}],
      [1.4, {"context": "4% · 35.3k", "spin": {"verb": "Sautéing", "tail": "↓ 138 tokens"}}],
      [2.4, {"context": "4% · 35.3k", "spin": {"verb": "Sautéing", "tail": "↓ 245 tokens"}}],
      [3.4, {"context": "4% · 35.3k", "spin": {"verb": "Sautéing", "tail": "↓ 265 tokens"}}],
      [4.4, {"context": "4% · 35.3k", "spin": {"verb": "Sautéing", "tail": "↓ 271 tokens"}}],
      [6.4, {"context": "4% · 36.3k", "spin": {"verb": "Sautéing", "tail": "↓ 384 tokens"}}],
      [6.4, {"context": "4% · 36.3k", "spin": {"verb": "Sautéing", "tail": "↓ 533 tokens"}}],
      [7.4, {"context": "4% · 36.3k", "spin": {"verb": "Sautéing", "tail": "↓ 569 tokens"}}],
      [8.4, {"context": "4% · 36.3k", "spin": {"verb": "Sautéing", "tail": "↓ 577 tokens"}}],
      [9.4, {"context": "4% · 36.3k", "spin": {"verb": "Sautéing", "tail": "↓ 615 tokens"}}],
      [9.4, {"context": "4% · 38k", "spin": {"verb": "Sautéing", "tail": "↓ 777 tokens"}}],
      [10.4, {"context": "4% · 38k", "spin": {"verb": "Sautéing", "tail": "↓ 853 tokens"}}],
      [11.4, {"context": "4% · 38k", "spin": {"verb": "Sautéing", "tail": "↓ 863 tokens"}}],
      [11.4, {"context": "4% · 38k", "spin": {"verb": "Sautéing", "tail": "↓ 864 tokens"}}],
      [14.4, {"context": "4% · 38k", "spin": {"verb": "Sautéing", "tail": "↓ 889 tokens"}}],
      [15.4, {"context": "4% · 39.7k", "spin": {"verb": "Sautéing", "tail": "↓ 1.1k tokens"}}],
      [16.4, {"context": "4% · 39.7k", "spin": {"verb": "Sautéing", "tail": "↓ 1.2k tokens"}}],
      [17.4, {"context": "4% · 39.7k", "spin": {"verb": "Sautéing", "tail": "↓ 1.3k tokens"}}],
      [43.4, {"context": "4% · 39.7k", "spin": {"verb": "Sautéing", "tail": "↓ 1.4k tokens"}}],
      [44.4, {"context": "4% · 40.9k", "spin": {"verb": "Sautéing", "tail": "↓ 1.5k tokens"}}],
      [46.4, {"context": "4% · 40.9k", "spin": {"verb": "Sautéing", "tail": "↓ 1.6k tokens"}}],
      [48.4, {"context": "4% · 40.9k", "spin": {"verb": "Sautéing", "tail": "↓ 1.7k tokens"}}],
      [49.4, {"context": "4% · 40.9k", "spin": {"verb": "Sautéing", "tail": "↓ 1.8k tokens"}}],
      [51.4, {"context": "4% · 41.6k", "spin": {"verb": "Sautéing", "tail": "↓ 1.9k tokens"}}],
      [52.4, {"context": "4% · 41.6k", "spin": {"verb": "Sautéing", "tail": "↓ 2.0k tokens"}}],
      [53.4, {"context": "4% · 41.6k", "spin": {"verb": "Sautéing", "tail": "↓ 2.1k tokens"}}],
      [54.4, {"context": "4% · 41.6k", "spin": {"verb": "Sautéing", "tail": "↓ 2.2k tokens"}}],
      [55.4, {"context": "4% · 41.6k", "spin": {"verb": "Sautéing", "tail": "↓ 2.3k tokens"}}],
      [56.4, {"context": "4% · 41.6k", "spin": {"verb": "Sautéing", "tail": "↓ 2.4k tokens"}}],
      [57.4, {"context": "4% · 41.6k", "spin": {"verb": "Sautéing", "tail": "↓ 2.5k tokens"}}],
      [59.4, {"context": "4% · 41.6k", "spin": {"verb": "Sautéing", "tail": "↓ 2.6k tokens"}}],
      [59.4, {"context": "4% · 41.6k", "spin": {"verb": "Sautéing", "tail": "↓ 2.7k tokens"}}],
      [64.4, {"context": "4% · 41.6k"}],
      [65.4, {"context": "4% · 44.9k"}],
      [67.4, {"context": "4% · 44.9k", "spin": {"verb": "Contemplating"}}],
    ],
    reply: [
      "I've started three subagents, one per branch, and each is merging `main` into its branch in its own worktree:",
      "",
      "- `.worktrees/no-empty-link`",
      "- `.worktrees/max-heading-depth`",
      "- `.worktrees/image-alt`",
      "",
      "**The conflict:** git flags `src/rules/index.js` in all three. Each branch and `main` (with `no-bare-url`) added a rule at the same spot. The fix is to keep both entries, with `main`'s first.",
      "",
      "**A second problem git won't flag:** `README.md`, the help text in `src/cli.js` and `test/rules.test.js` each hard-code the rule count. Both sides changed it from 12 to 13, so git merges them cleanly to 13, but the right number after the merge is 14. Only the test would catch it; the README and help text would quietly stay wrong. Each subagent has been told to fix all three, run `npm test`, check `--help`, and commit the merge on its branch. Nothing gets pushed and `main` isn't touched.",
      "",
      "I'll check each branch myself once the subagents report back.",
      "",
      "**What happens next:** once one of these branches lands on `main`, the other two will conflict again in `index.js`. Their counts will also merge cleanly to 14 when they should be 15 and then 16. The cause is that the count is written down in three places. Using `rules.length` instead would remove it, but I haven't made that change because it's beyond what you asked.",
    ],
    keys: [
      [
        -2.1,
        "type",
        "Three rule branches conflict with main now: rule/no-empty-link, rule/max-heading-depth and rule/image-alt. Resolve them, one subagent per branch, each in its own worktree under .worktrees/."
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
          "`rule/no-empty-link` is done, and I checked it myself rather than relying on the subagent's report. The merge commit is `418cac2`:",
          "",
          "- **Merges into `main`:** no conflicts left.",
          "- **Conflict fixed:** no conflict markers remain in `src/rules/index.js`.",
          "- **Rule count:** `README.md`, the help text in `src/cli.js` and the test all say 14.",
          "- **Tests:** `npm test` passes, 4 of 4.",
          "",
          "The subagents for `rule/max-heading-depth` and `rule/image-alt` are still running. I'll run the same checks on each when they report back."
        ]
      },
      {
        "tools": "Ran 1 agent, ran 2 shell commands",
        "reply": [
          "All three branches are resolved. Each one now merges into `main` with no conflicts, and I checked every branch myself rather than relying on the subagents' reports.",
          "",
          "| Branch | Merge commit | Worktree | `npm test` |",
          "|---|---|---|---|",
          "| `rule/no-empty-link` | `418cac2` | `.worktrees/no-empty-link` | 4/4 pass |",
          "| `rule/max-heading-depth` | `9f5ba77` | `.worktrees/max-heading-depth` | 4/4 pass |",
          "| `rule/image-alt` | `c79c299` | `.worktrees/image-alt` | 4/4 pass |",
          "",
          "**What each merge does:**",
          "- **The conflict:** in `src/rules/index.js`, it keeps both new rules, with `main`'s `NoBareUrl` first and then the branch's own rule. No conflict markers remain.",
          "- **The rule count:** it fixes the count that git had merged to 13 without flagging it, which should be 14. `README.md`, the help text in `src/cli.js`, and the test title and assertion in `test/rules.test.js` now all say 14.",
          "",
          "`main` is unchanged and still at `ad4c735`. Nothing was pushed (the repo has no remote).",
          "",
          "**What happens when they land:** the three branches will still conflict with each other. Once one is merged into `main`, the other two will:",
          "- conflict again in `index.js`, because all three add a line at the same spot;",
          "- merge the rule count cleanly to 14 when it should be 15 and then 16. Only the test assertion would catch that; the README and help text would quietly stay wrong.",
          "",
          "The cause is the count written by hand in three places. Deriving it from `rules.length` in the help text, and dropping it from the README, would remove the problem. I haven't made that change; tell me if you want it before these branches land."
        ]
      }
    ],
  },
];
