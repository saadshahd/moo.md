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
      [5.3, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 270 tokens"}}],
      [6.3, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 275 tokens"}}],
      [7.3, {"context": "4% · 35.3k", "spin": {"verb": "Scampering", "tail": "↓ 313 tokens"}}],
      [8.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 475 tokens"}}],
      [9.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 647 tokens"}}],
      [9.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 685 tokens"}}],
      [10.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 734 tokens"}}],
      [11.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 766 tokens"}}],
      [12.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 842 tokens"}}],
      [12.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 887 tokens"}}],
      [13.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 968 tokens"}}],
      [14.3, {"context": "4% · 36.6k", "spin": {"verb": "Scampering", "tail": "↓ 1.2k tokens"}}],
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
];
