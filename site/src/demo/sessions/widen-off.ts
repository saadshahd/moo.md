import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "After I press play in the preview, the card's keyframes in the editor jump to the end values. Fix it.",
    tools: "Edited 1 file +12, listed 2 directories, ran 2 shell commands",
    activity: [
      {"at": 2.1, "line": "Running ls -R | grep -v node_modules | head -**50** && ls .co…", "tool": "$ ls -R | grep -v node_modules | head -50 && ls .codegraph 2>/dev/null; cat src/*.js | wc -l"},
      {"at": 4.1, "line": "Running ls -R | grep -v node_modules | head -**50** && ls .co…", "tool": "$ cat src/doc.js src/preview.js test/preview.test.js; ls vendor/tweenkit; cat vendor/tweenkit/*.js"},
      {"at": 7.1, "line": "Running grep -rn \"tweenkit\\|play(\" src test; npm test **2**>&…", "tool": "$ grep -rn \"tweenkit\\|play(\" src test; npm test 2>&1 | tail -15"},
      {"at": 12.1, "line": "Running grep -rn \"tweenkit\\|play(\" src test; npm test **2**>&…", "tool": "$ npm test 2>&1 | grep -E \"^# (pass|fail)\""},
    ],
    replyAt: 18.9,
    chrome: [
      [-2.9, {"context": "0%"}],
      [0.1, {"context": "0%", "spin": {"verb": "Sautéing"}}],
      [1.1, {"context": "0%", "spin": {"verb": "Prestidigitating"}}],
      [2.1, {"context": "4% · 35.3k", "spin": {"verb": "Prestidigitating", "tail": "↓ 22 tokens"}}],
      [2.1, {"context": "4% · 35.3k", "spin": {"verb": "Prestidigitating", "tail": "↓ 33 tokens"}}],
      [3.1, {"context": "4% · 35.3k", "spin": {"verb": "Prestidigitating", "tail": "↓ 96 tokens"}}],
      [4.1, {"context": "4% · 35.3k", "spin": {"verb": "Prestidigitating", "tail": "↓ 117 tokens"}}],
      [5.1, {"context": "4% · 35.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 207 tokens"}}],
      [5.1, {"context": "4% · 35.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 216 tokens"}}],
      [6.1, {"context": "4% · 35.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 219 tokens"}}],
      [7.1, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 419 tokens"}}],
      [8.1, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 471 tokens"}}],
      [8.1, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 483 tokens"}}],
      [10.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 646 tokens"}}],
      [11.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 735 tokens"}}],
      [11.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating"}}],
      [12.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 821 tokens"}}],
      [13.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 872 tokens"}}],
      [14.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 884 tokens"}}],
      [14.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 887 tokens"}}],
      [19.1, {"context": "4% · 38.1k"}],
    ],
    reply: [
      "Fixed. Pressing play no longer changes the card's keyframes in the editor.",
      "",
      "**Cause:** the bug is in how we call the copied library `tweenkit`. Its `play()` uses `frames[0]` as its working state and writes every frame's values into it. So after playback, the first keyframe holds the end values: x=120, opacity 1. It also re-sorts the keyframes array in place. `src/preview.js` was passing `shape.keyframes` straight from the document, and the editor draws from that same object, so the change showed up in the editor.",
      "",
      "**Fix (`src/preview.js`):** `previewShape` now gives `play()` a full copy made with `structuredClone(shape.keyframes)`, plus a comment explaining why. I made it a deep copy because copying only the array wouldn't help: `play()` writes into the first keyframe object itself. Per `CLAUDE.md`, `vendor/` stays unedited. The preview still gets the same frames, so the last frame is still drawn at x=120.",
      "",
      "**Checked:** `npm test` passes 5 of 5. That includes the existing test for this bug report (\"playing a preview leaves the editor's keyframes as they were\"), which failed before the fix. The only other place that uses tweenkit is `timeline.js`, which calls `duration()`; that function only reads the keyframes and doesn't change them.",
      "",
      "I tested this with the test suite only, not by pressing play in a browser.",
    ],
    keys: [
      [
        -2.2,
        "type",
        "After I press play in the preview, the card's keyframes in the editor jump to the end values. Fix it."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
];
