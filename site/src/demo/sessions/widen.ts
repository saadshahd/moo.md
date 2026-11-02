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
      [5.1, {"context": "4% · 35.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 207 tokens · thinking with medium effort"}}],
      [5.1, {"context": "4% · 35.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 216 tokens · thinking with medium effort"}}],
      [6.1, {"context": "4% · 35.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 219 tokens · thinking with medium effort"}}],
      [7.1, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 419 tokens · thought for 2s"}}],
      [8.1, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 471 tokens · thought for 2s"}}],
      [8.1, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 483 tokens · thought for 2s"}}],
      [9.1, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 483 tokens · thinking with medium effort"}}],
      [10.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 646 tokens · thinking with medium effort"}}],
      [11.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 735 tokens · thinking with medium effort"}}],
      [11.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating"}}],
      [12.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 821 tokens · thought for 1s"}}],
      [13.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 872 tokens"}}],
      [14.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 884 tokens · thinking with medium effort"}}],
      [14.1, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 887 tokens · thinking with medium effort"}}],
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
  {
    user: "/hope:widen",
    tools: "Ran 2 shell commands",
    activity: [
      {"at": 3.3, "line": "Running for f in vendor/\\*/index.js; do echo \"== $f\"; cat …", "tool": "$ for f in vendor/*/index.js; do echo \"== $f\"; cat $f; done; echo; grep -rn \"vendor/\" src; for f in src/editor/*.js src/export/*.js src/panels/*.js src/share/*.js src/history.js; do echo \"== $f\"; cat $f; done"},
      {"at": 24.3, "line": "Running cat > $TMPDIR/p.mjs <<'EOF' import { createDoc } f…", "tool": "$ cat > $TMPDIR/p.mjs <<'EOF'\nimport { createDoc } from \"/Users/Shared/motionpad/src/doc.js\";\nimport { layerRows } from \"/Users/Shared/motionpad/src/panels/layers.js\";\nimport { exportSvg } from \"/Users/Shared/motionpad/src/export/svg.js\";\nimport { timelineRows } from \"/Users/Shared/motionpad/src/panels/timeline.js\";\nlet d = createDoc(); layerRows(d); layerRows(d); console.log(\"fill after 2 renders\", d.shapes[0].fill);\nd = createDoc(); exportSvg(d); console.log(\"after svg export\", JSON.stringify(d.shapes[0]));\nd = createDoc(); const s = d.shapes; timelineRows(d); console.log(\"timeline sorts doc array in place:\", d.shapes === s, timelineRows(d));\nEOF\nnode $TMPDIR/p.mjs"},
    ],
    replyAt: 35.5,
    chrome: [
      [-110.7, {"context": "0%", "spin": {"verb": "Sautéing"}}],
      [-109.7, {"context": "0%", "spin": {"verb": "Prestidigitating"}}],
      [-108.7, {"context": "4% · 35.3k", "spin": {"verb": "Prestidigitating", "tail": "↓ 22 tokens"}}],
      [-108.7, {"context": "4% · 35.3k", "spin": {"verb": "Prestidigitating", "tail": "↓ 33 tokens"}}],
      [-107.7, {"context": "4% · 35.3k", "spin": {"verb": "Prestidigitating", "tail": "↓ 96 tokens"}}],
      [-106.7, {"context": "4% · 35.3k", "spin": {"verb": "Prestidigitating", "tail": "↓ 117 tokens"}}],
      [-105.7, {"context": "4% · 35.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 207 tokens · thinking with medium effort"}}],
      [-105.7, {"context": "4% · 35.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 216 tokens · thinking with medium effort"}}],
      [-104.7, {"context": "4% · 35.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 219 tokens · thinking with medium effort"}}],
      [-103.7, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 419 tokens · thought for 2s"}}],
      [-102.7, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 471 tokens · thought for 2s"}}],
      [-102.7, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 483 tokens · thought for 2s"}}],
      [-101.7, {"context": "4% · 37k", "spin": {"verb": "Prestidigitating", "tail": "↓ 483 tokens · thinking with medium effort"}}],
      [-100.7, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 646 tokens · thinking with medium effort"}}],
      [-99.7, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 735 tokens · thinking with medium effort"}}],
      [-99.7, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating"}}],
      [-98.7, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 821 tokens · thought for 1s"}}],
      [-97.7, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 872 tokens"}}],
      [-96.7, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 884 tokens · thinking with medium effort"}}],
      [-96.7, {"context": "4% · 37.6k", "spin": {"verb": "Prestidigitating", "tail": "↓ 887 tokens · thinking with medium effort"}}],
      [-91.7, {"context": "4% · 38.1k"}],
      [-16.7, {"context": "4% · 38.1k", "style": "hold:Plain"}],
      [-0.7, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Zigzagging"}}],
      [1.3, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "thinking with medium effort"}}],
      [2.3, {"context": "5% · 45k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 113 tokens · thought for 2s"}}],
      [3.3, {"context": "5% · 45k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 275 tokens · thought for 2s"}}],
      [3.3, {"context": "5% · 45k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 340 tokens · thought for 2s"}}],
      [4.3, {"context": "5% · 45k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 351 tokens"}}],
      [5.3, {"context": "5% · 45k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 351 tokens · thinking with medium effort"}}],
      [15.3, {"context": "5% · 45k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 351 tokens · still thinking with medium effort"}}],
      [21.3, {"context": "5% · 45k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 1.7k tokens · thought for 16s"}}],
      [22.3, {"context": "5% · 48k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 1.7k tokens · thought for 16s"}}],
      [22.3, {"context": "5% · 48k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 1.8k tokens · thought for 16s"}}],
      [23.3, {"context": "5% · 48k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 1.8k tokens"}}],
      [24.3, {"context": "5% · 48k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 1.9k tokens"}}],
      [24.3, {"context": "5% · 48k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 2.1k tokens · thinking with medium effort"}}],
      [26.3, {"context": "5% · 48k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 2.2k tokens · thinking with medium effort"}}],
      [35.3, {"context": "5% · 48k", "style": "hold:Plain", "spin": {"verb": "Nebulizing", "tail": "↓ 2.2k tokens · thought for 10s"}}],
      [35.3, {"context": "5% · 50k", "style": "hold:Plain"}],
    ],
    reply: [
      "**Rule:** only a user edit may write the document; anything else gets a copy that covers every write it makes.",
      "",
      "Reading-only calls get the original.",
      "What a vendor function writes, its source decides.",
      "",
      "| Case | Wrong answer | What the rule forces |",
      "|---|---|---|",
      "| `preview.js` → tweenkit `play` | pass `shape.keyframes` | deep copy (fixed, tested) |",
      "| `layers.js` → `toLinear(s.fill)` | pass `fill`; ran: colour drifts each render | `toLinear({ ...s.fill })` |",
      "| `svg.js` → svgpack `pack` | pass `doc.shapes`; ran: keyframes and ids lost | `pack(structuredClone(doc.shapes))` |",
      "| `timeline.js` → `sortBy(doc.shapes)` | sort the doc's array in place | `sortBy([...doc.shapes], …)` |",
      "| `timeline.js` `lanes` → `sortBy([...])` | none | copy of the array is enough |",
      "| `canvas.js` `[...doc.shapes].sort` | none | copy of the array is enough |",
      "| `history.js` → `diff(last, …)` | none | `last` is history's own clone |",
      "| `inspector.js` `setValue` | none | it is the edit; write in place |",
      "| `duration`, `viewBox`, `toHex`, `mix`, `groupBy` | none | read only; pass original |",
      "",
      "| Situation outside the set | Forced answer |",
      "|---|---|",
      "| undo applies a diff to the doc | write in place; undo is a user edit |",
      "| `diff(doc, next)` called on the live doc | copy `doc` first; `diff` writes `before` |",
      "| `mix(s.fill, other, k)` | pass original; `mix` returns new |",
      "| export to JSON or share link | pass original; read only |",
      "| play a shape whose `t` values are unsorted | still copy; `play` sorts in place |",
      "| new vendor lib, writes unknown | read its source before calling |",
      "| `pack` on a list you built this call | no copy; you own it |",
      "| drag in canvas sets `x` | write in place; user edit |",
      "| a callee keeps an arg and writes it later | copy; the write still lands |",
      "| test fixture from `createDoc()` | each test owns it; no copy |",
      "",
      "No case where the rule gives a wrong answer turned up.",
      "",
      "Separate bug: `timelineRows` sorts by an `\"end\"` key that shapes lack.",
      "So the 600 ms card lists before the 450 ms badge.",
      "",
      "Next: copy before the calls in `layers.js`, `svg.js` and `timeline.js`, plus a test for each.",
    ],
    keys: [
      [
        -2.9,
        "type",
        "/hope:widen"
      ],
      [
        -0.3,
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
            "hope:widen",
            "l b"
          ],
          [
            "                     (hope) Assemble cases from context, induce",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "the widest sound rule. Use when a real ca…",
            "l"
          ]
        ],
        [
          [
            "  "
          ],
          [
            "  /hope:intent                    (hope) Turn a rough ask into a clear work",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "order. Use when the ask is rough, unspoke…",
            "g"
          ]
        ]
      ]
    },
  },
];
