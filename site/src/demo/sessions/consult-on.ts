import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:consult A teammate wants to delete our unit tests and test billing only end to end (docs/proposal-e2e-only.md). Are they right?",
    tools: "Ran 2 shell commands",
    activity: [
      {"at": 5.3, "line": "Running git ls-files && cat docs/proposal-e**2**e-only.md && …", "tool": "$ git ls-files && cat docs/proposal-e2e-only.md && ls docs; for f in docs/*; do echo \"== $f\"; cat \"$f\"; done; ls ~/.claude/plugins/cache/moo-md/hope/skills/consult/profiles 2>/dev/null"},
      {"at": 10.3, "line": "Running git ls-files && cat docs/proposal-e**2**e-only.md && …", "tool": "$ cat package.json src/*.js test/unit/*.js test/e2e/*.js; P=~/.claude/plugins/cache/moo-md/hope/skills/consult/profiles; head -30 $P/freeman.md $P/humble.md $P/beck.md $P/feathers.md"},
    ],
    replyAt: 42.8,
    chrome: [
      [-2.7, {"context": "0%", "style": "hold:Plain"}],
      [-0.7, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Nesting"}}],
      [4.3, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 113 tokens · thinking with medium effort"}}],
      [5.3, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 180 tokens"}}],
      [6.3, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 216 tokens · thought for 1s"}}],
      [7.3, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 225 tokens · thought for 1s"}}],
      [8.3, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 225 tokens"}}],
      [9.3, {"context": "4% · 38.5k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 243 tokens"}}],
      [10.3, {"context": "4% · 40.1k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 357 tokens"}}],
      [10.3, {"context": "4% · 40.1k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 375 tokens"}}],
      [11.3, {"context": "4% · 40.1k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 384 tokens"}}],
      [14.3, {"context": "4% · 40.1k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 384 tokens · thinking with medium effort"}}],
      [24.3, {"context": "4% · 40.1k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 384 tokens · still thinking with medium effort"}}],
      [33.3, {"context": "4% · 40.1k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 384 tokens · thinking more with medium effort"}}],
      [43.3, {"context": "4% · 44.1k", "style": "hold:Plain"}],
    ],
    reply: [
      "1. Freeman — **Write one contract test; run it on the fake and staging**",
      "   *A fake earns trust only when one test checks it and the real thing.*",
      "   Chosen because the incident was fake drift, and this test fails on it.",
      "",
      "2. Humble — **Run that contract test against staging every hour**",
      "   *The break came from their deploy, so gating our PRs would miss it.*",
      "   Chosen because payments v3 shipped with no PR of ours.",
      "   31 h went by before the break surfaced.",
      "",
      "3. Beck — **Keep the 2 s unit tests; add one for a \"pending\" charge**",
      "   *A pending charge marks the invoice unpaid, so dunning would mail them.*",
      "   Chosen because `src/invoices.js:9` maps every non-success to \"unpaid.\"",
      "",
      "4. Teammate — Delete `test/unit/`; test billing only against staging",
      "   *A test that skips the real service tells us nothing.*",
      "   Doesn't apply because e2e takes 14 min.",
      "   e2e can't run locally.",
      "   On PRs it still would not have caught a break from their deploy.",
      "",
      "Win: a payments shape change fails a test within an hour, not 31 h.",
      "",
      "Next: decide what a \"pending\" charge should set; then I write all three.",
    ],
    keys: [
      [
        -1.9,
        "type",
        "/hope:consult A teammate wants to delete our unit tests and test billing only end to end (docs/proposal-e2e-only.md). Are they right?"
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
];
