import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:reframe Let's build our own Pixlane clone: snapshot every screen's HTML on each PR, diff it against main, and a command to approve the diffs. Start it.",
    tools: "Ran 3 shell commands",
    activity: [
      {"at": 5.2, "line": "Running cd /Users/Shared/shopdec**1**; cat docs/visual-checks…", "tool": "$ cd /Users/Shared/shopdeck; cat docs/visual-checks.md; ls -R src test* 2>/dev/null | head -50; cat package.json; cat src/screens/index.js"},
      {"at": 8.2, "line": "Running cd /Users/Shared/shopdec**1**; cat docs/visual-checks…", "tool": "$ cd /Users/Shared/shopdeck; cat test/screens.test.js; cat src/screens/home.js; ls -a; ls .github 2>/dev/null -R; git log --stat | head -30"},
      {"at": 17.2, "line": "Running node --version; node --help | grep -i snapshot", "tool": "$ node --version; node --help | grep -i snapshot"},
    ],
    replyAt: 22.8,
    chrome: [
      [-2.8, {"context": "0%", "style": "hold:Plain"}],
      [-0.8, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Catapulting"}}],
      [3.2, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "thinking with medium effort"}}],
      [5.2, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 138 tokens · thought for 2s"}}],
      [5.2, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 222 tokens · thought for 2s"}}],
      [6.2, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 231 tokens"}}],
      [7.2, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 234 tokens · thinking with medium effort"}}],
      [8.2, {"context": "4% · 39k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 391 tokens · thinking with medium effort"}}],
      [8.2, {"context": "4% · 39k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 434 tokens"}}],
      [9.2, {"context": "4% · 39k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 443 tokens · thought for 1s"}}],
      [11.2, {"context": "4% · 39k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 443 tokens · thinking with medium effort"}}],
      [17.2, {"context": "4% · 39k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 1.0k tokens · thought for 7s"}}],
      [18.2, {"context": "4% · 40k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 1.1k tokens · thought for 7s"}}],
      [19.2, {"context": "4% · 40k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 1.1k tokens · thinking with medium effort"}}],
      [22.2, {"context": "4% · 40k", "style": "hold:Plain", "spin": {"verb": "Propagating", "tail": "↓ 1.1k tokens · thought for 3s"}}],
      [23.2, {"context": "4% · 40.9k", "style": "hold:Plain"}],
    ],
    reply: [
      "**The reframe:** let no PR merge until a reviewer has seen every change to a screen's HTML.",
      "",
      "Screen HTML is plain text, so committed snapshot files make the PR's own diff the review.",
      "`npm test` fails until someone approves.",
      "The approve command is `--test-update-snapshots` on Node 22.18.",
      "That drops the hosted store, diff viewer and approval UI.",
      "",
      "Next step: add one `t.assert.snapshot` test per screen to `test/screens.test.js`. Say go and I'll write it.",
    ],
    keys: [
      [
        -2.4,
        "type",
        "/hope:reframe Let's build our own Pixlane clone: snapshot every screen's HTML on each PR, diff it against main, and a command to approve the diffs. Start it."
      ],
      [
        -0.6,
        "key",
        "Enter"
      ]
    ],
  },
];
