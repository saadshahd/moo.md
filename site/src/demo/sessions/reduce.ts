import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "write the PR description: price_cache.ts TTL 5m -> 1h to cut catalog load; tests updated and passing, hit rate up locally. The reviewer wrote price_cache.ts.",
    tools: "Read 1 file, ran 2 shell commands",
    activity: [
      {"at": 1.8, "line": "Running git diff && git show --stat HEAD && cat src/price…", "tool": "$ git diff && git show --stat HEAD && cat src/price_cache.ts"},
      {"at": 3.8, "line": "Running git diff && git show --stat HEAD && cat src/price…", "tool": "$ cat src/price_events.ts README.md package.json"},
      {"at": 5.8, "line": "Running git diff && git show --stat HEAD && cat src/price…", "tool": "$ npm test 2>&1 | tail -15"},
    ],
    replyAt: 15.0,
    chrome: [
      [-2.2, {"context": "0%"}],
      [-0.2, {"context": "0%", "spin": {"verb": "Wrangling"}}],
      [0.8, {"context": "0%", "spin": {"verb": "Befuddling", "tail": "thinking with medium effort"}}],
      [1.8, {"context": "4% · 35.1k", "spin": {"verb": "Befuddling", "tail": "↓ 157 tokens"}}],
      [2.8, {"context": "4% · 35.1k", "spin": {"verb": "Befuddling", "tail": "↓ 183 tokens · thinking with medium effort"}}],
      [2.8, {"context": "4% · 35.1k", "spin": {"verb": "Befuddling", "tail": "↓ 192 tokens · thinking with medium effort"}}],
      [3.8, {"context": "4% · 36.7k", "spin": {"verb": "Befuddling", "tail": "↓ 380 tokens · thinking with medium effort"}}],
      [4.8, {"context": "4% · 36.7k", "spin": {"verb": "Befuddling", "tail": "↓ 403 tokens · thinking with medium effort"}}],
      [5.8, {"context": "4% · 37.1k", "spin": {"verb": "Befuddling", "tail": "↓ 575 tokens"}}],
      [5.8, {"context": "4% · 37.1k", "spin": {"verb": "Befuddling", "tail": "↓ 590 tokens · thought for 1s"}}],
      [6.8, {"context": "4% · 37.1k", "spin": {"verb": "Befuddling", "tail": "↓ 599 tokens · thinking with medium effort"}}],
      [14.8, {"context": "4% · 37.1k"}],
      [15.8, {"context": "4% · 37.3k"}],
    ],
    reply: [
      "I checked the diff and ran `npm test`: 3/3 pass. Here's the description:",
      "",
      "```markdown",
      "## catalog: raise price cache TTL from 5 min to 1 h",
      "",
      "### What",
      "`TTL_MS` in `src/price_cache.ts` goes from `5 * 60 * 1000` to `60 * 60 * 1000`. The two tests that check the TTL edges move from 4/6 min to 59/61 min.",
      "",
      "### Why",
      "To cut calls from catalog to the pricing service. Each `PriceCache.get` miss is one call. A `price.changed` event still drops the SKU right away (`src/price_events.ts`), so a normal price change shows up as fast as before.",
      "",
      "Hit rate locally: <before → after, and how it was measured>",
      "",
      "### Tradeoff",
      "As the comment in `price_cache.ts` says, the TTL \"only bounds how long a missed event can leave a stale price on the page.\" This change raises that limit from **5 minutes to 1 hour**. If a `price.changed` event is lost, a product page can show the old price for up to an hour.",
      "",
      "This is fine only if missed events are rare enough, or an hour of a wrong price is acceptable. <How often events are missed / why an hour is OK.>",
      "",
      "### Testing",
      "- `npm test`: 3/3 pass.",
      "- The tests check the new TTL edges (hit at 59 min, refetch at 61 min) and that a `price.changed` event drops the SKU. No test covers a missed event, because the TTL is the only protection there.",
      "```",
      "",
      "Fill in two things before you post it:",
      "",
      "- **Hit-rate numbers.** \"Hit rate up locally\" isn't enough evidence. `PriceCache` already counts `hits`/`misses`, so before/after numbers from the same local run are easy to get. A local run also probably doesn't reflect how production traffic is spread across SKUs.",
      "- **Why an hour of possible staleness is OK.** The reviewer wrote the comment that says the TTL limits stale prices. A 12× longer TTL is the first thing they'll ask about, so the description should answer it.",
    ],
    keys: [
      [
        -2.1,
        "type",
        "write the PR description: price_cache.ts TTL 5m -> 1h to cut catalog load; tests updated and passing, hit rate up locally. The reviewer wrote price_cache.ts."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
  {
    user: "/hope:reduce",
    replyAt: 6.7,
    chrome: [
      [-60.5, {"context": "0%", "spin": {"verb": "Befuddling", "tail": "thinking with medium effort"}}],
      [-59.5, {"context": "4% · 35.1k", "spin": {"verb": "Befuddling", "tail": "↓ 157 tokens"}}],
      [-58.5, {"context": "4% · 35.1k", "spin": {"verb": "Befuddling", "tail": "↓ 183 tokens · thinking with medium effort"}}],
      [-58.5, {"context": "4% · 35.1k", "spin": {"verb": "Befuddling", "tail": "↓ 192 tokens · thinking with medium effort"}}],
      [-57.5, {"context": "4% · 36.7k", "spin": {"verb": "Befuddling", "tail": "↓ 380 tokens · thinking with medium effort"}}],
      [-56.5, {"context": "4% · 36.7k", "spin": {"verb": "Befuddling", "tail": "↓ 403 tokens · thinking with medium effort"}}],
      [-55.5, {"context": "4% · 37.1k", "spin": {"verb": "Befuddling", "tail": "↓ 575 tokens"}}],
      [-55.5, {"context": "4% · 37.1k", "spin": {"verb": "Befuddling", "tail": "↓ 590 tokens · thought for 1s"}}],
      [-54.5, {"context": "4% · 37.1k", "spin": {"verb": "Befuddling", "tail": "↓ 599 tokens · thinking with medium effort"}}],
      [-46.5, {"context": "4% · 37.1k"}],
      [-45.5, {"context": "4% · 37.3k"}],
      [-22.5, {"context": "4% · 37.3k", "style": "hold:Plain"}],
      [-0.5, {"context": "4% · 37.3k", "style": "hold:Plain", "spin": {"verb": "Twisting"}}],
      [0.5, {"context": "4% · 37.3k", "style": "hold:Plain", "spin": {"verb": "Bootstrapping", "tail": "thinking with medium effort"}}],
      [4.5, {"context": "4% · 37.3k", "style": "hold:Plain", "spin": {"verb": "Bootstrapping", "tail": "↓ 25 tokens · thought for 4s"}}],
      [5.5, {"context": "4% · 44.4k", "style": "hold:Plain"}],
      [31.5, {"context": "4% · 44.4k", "style": "hold:Plain", "spin": {"verb": "Photosynthesizing"}}],
      [31.5, {"context": "4% · 44.4k", "style": "hold:Plain", "spin": {"verb": "Photosynthesizing", "tail": "thinking with medium effort"}}],
    ],
    reply: [
      "```markdown",
      "## catalog: raise price cache TTL from 5 min to 1 h",
      "",
      "Cuts calls to the pricing service. A `price.changed` event still drops the SKU",
      "right away, so normal price changes show up as fast as before.",
      "",
      "Hit rate locally: <before → after>",
      "",
      "**Tradeoff:** the TTL is the only limit on a stale price after a missed event",
      "(see the comment in `price_cache.ts`). A lost event can now leave the old price",
      "on a product page for up to 1 h instead of 5 min. <Why an hour is acceptable.>",
      "",
      "**Tests:** `npm test` passes 3/3. The TTL edge tests now use 59 and 61 min.",
      "No test covers a missed event.",
      "```",
    ],
    keys: [
      [
        -2.7,
        "type",
        "/hope:reduce"
      ],
      [
        -0.1,
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
            "hope:reduce",
            "l b"
          ],
          [
            "                    (hope) Re-derive something written into",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "the shortest version that still covers ev…",
            "l"
          ]
        ],
        [
          [
            "  "
          ],
          [
            "  /hope:router                    (hope) Spawn agents and verify their",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "output — route work, never do it. Use whe…",
            "g"
          ]
        ]
      ]
    },
  },
  {
    user: "/hope:reduce",
    replyAt: 5.9,
    chrome: [
      [-31.0, {"context": "4% · 37.3k", "style": "hold:Plain", "spin": {"verb": "Twisting"}}],
      [-31.0, {"context": "4% · 37.3k", "style": "hold:Plain", "spin": {"verb": "Bootstrapping", "tail": "thinking with medium effort"}}],
      [-27.0, {"context": "4% · 37.3k", "style": "hold:Plain", "spin": {"verb": "Bootstrapping", "tail": "↓ 25 tokens · thought for 4s"}}],
      [-26.0, {"context": "4% · 44.4k", "style": "hold:Plain"}],
      [-0.0, {"context": "4% · 44.4k", "style": "hold:Plain", "spin": {"verb": "Photosynthesizing"}}],
      [-0.0, {"context": "4% · 44.4k", "style": "hold:Plain", "spin": {"verb": "Photosynthesizing", "tail": "thinking with medium effort"}}],
      [5.0, {"context": "5% · 45.6k", "style": "hold:Plain"}],
    ],
    reply: [
      "```markdown",
      "## catalog: price cache TTL 5 min → 1 h",
      "",
      "Cuts calls to the pricing service. `price.changed` still drops a SKU at once.",
      "Hit rate locally: <before → after>",
      "",
      "**Tradeoff:** if a `price.changed` event is missed, the old price can now stay",
      "up for 1 h instead of 5 min (see the comment in `price_cache.ts`).",
      "<Why an hour is acceptable.>",
      "",
      "**Tests:** 3/3 pass. The TTL edge tests now use 59 and 61 min.",
      "No test covers a missed event.",
      "```",
    ],
    keys: [
      [
        -2.6,
        "type",
        "/hope:reduce"
      ],
      [
        -0.1,
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
            "hope:reduce",
            "l b"
          ],
          [
            "                    (hope) Re-derive something written into",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "the shortest version that still covers ev…",
            "l"
          ]
        ],
        [
          [
            "  "
          ],
          [
            "  /hope:router                    (hope) Spawn agents and verify their",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "output — route work, never do it. Use whe…",
            "g"
          ]
        ]
      ]
    },
  },
  {
    user: "/hope:reduce",
    replyAt: 4.6,
    chrome: [
      [-15.9, {"context": "4% · 44.4k", "style": "hold:Plain", "spin": {"verb": "Photosynthesizing", "tail": "thinking with medium effort"}}],
      [-11.9, {"context": "5% · 45.6k", "style": "hold:Plain"}],
      [0.1, {"context": "5% · 45.6k", "style": "hold:Plain", "spin": {"verb": "Sautéing"}}],
      [1.1, {"context": "5% · 45.6k", "style": "hold:Plain", "spin": {"verb": "Sautéing", "tail": "thinking with medium effort"}}],
      [4.1, {"context": "5% · 46.8k", "style": "hold:Plain"}],
    ],
    reply: [
      "```markdown",
      "## catalog: price cache TTL 5 min → 1 h",
      "",
      "Cuts calls to the pricing service. `price.changed` still drops a SKU at once.",
      "Hit rate locally: <before → after>",
      "",
      "**Tradeoff:** if a `price.changed` event is missed, the old price can now stay",
      "up for 1 h instead of 5 min (see the comment in `price_cache.ts`).",
      "<Why an hour is acceptable.>",
      "",
      "**Tests:** 3/3 pass. The TTL edge tests now check 59 and 61 min. None covers",
      "a missed event.",
      "```",
    ],
    keys: [
      [
        -2.6,
        "type",
        "/hope:reduce"
      ],
      [
        -0.1,
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
            "hope:reduce",
            "l b"
          ],
          [
            "                    (hope) Re-derive something written into",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "the shortest version that still covers ev…",
            "l"
          ]
        ],
        [
          [
            "  "
          ],
          [
            "  /hope:router                    (hope) Spawn agents and verify their",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "output — route work, never do it. Use whe…",
            "g"
          ]
        ]
      ]
    },
  },
];
