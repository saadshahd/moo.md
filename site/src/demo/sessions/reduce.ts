import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "write the PR description: price_cache.ts TTL 5m -> 1h to cut catalog load; tests updated and passing, hit rate up locally. The reviewer wrote price_cache.ts.",
    tools: "Ran 3 shell commands",
    activity: [
      {"at": 1.5, "line": "Showing working diff, recent commits, and cache source", "tool": "$ git diff && git log --oneline -5 && ls -a && cat src/price_cache.ts"},
      {"at": 6.5, "line": "Showing working diff, recent commits, and cache source", "tool": "$ ls src test && git show --stat f0ff143 && cat README.md package.json && cat test/price_cache.test.ts && grep -rn \"price_events\\|price.changed\\|drop(\" --include=*.ts . | grep -v node_modules; npm test 2>&1 | tail -20"},
      {"at": 8.5, "line": "Reading event handler, prior commit body, and checking for open PR", "tool": "$ cat src/price_events.ts && git log -1 --format=%B f0ff143 && git remote -v && gh pr list --head price-cache-ttl 2>&1 | head"},
    ],
    replyAt: 93.0,
    chrome: [
      [-1.5, {"context": "0%"}],
      [-0.5, {"context": "0%", "spin": {"verb": "Waddling"}}],
      [0.5, {"context": "0%", "spin": {"verb": "Spelunking", "tail": "thinking with xhigh effort"}}],
      [1.5, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 75 tokens · thinking with xhigh effort"}}],
      [1.5, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 206 tokens"}}],
      [2.5, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 216 tokens · thought for 1s"}}],
      [3.5, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 222 tokens · thinking with xhigh effort"}}],
      [4.5, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 297 tokens · thinking with xhigh effort"}}],
      [5.5, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 472 tokens · thought for 2s"}}],
      [6.5, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 579 tokens · thought for 2s"}}],
      [6.5, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 590 tokens"}}],
      [7.5, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 617 tokens"}}],
      [8.5, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 713 tokens"}}],
      [9.5, {"context": "4% · 37.3k", "spin": {"verb": "Spelunking", "tail": "↓ 743 tokens · thinking with xhigh effort"}}],
      [9.5, {"context": "4% · 37.3k", "spin": {"verb": "Spelunking", "tail": "↓ 752 tokens · thinking with xhigh effort"}}],
      [19.5, {"context": "4% · 37.3k", "spin": {"verb": "Spelunking", "tail": "↓ 752 tokens · still thinking with xhigh effort"}}],
      [20.5, {"context": "4% · 37.3k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens · thought for 11s"}}],
      [21.5, {"context": "4% · 37.6k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens · thought for 11s"}}],
      [22.5, {"context": "4% · 37.6k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens"}}],
      [73.5, {"context": "4% · 37.6k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens · thinking with xhigh effort"}}],
      [83.5, {"context": "4% · 37.6k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens · still thinking with xhigh effort"}}],
      [92.5, {"context": "4% · 37.6k"}],
      [93.5, {"context": "4% · 39.5k"}],
    ],
    reply: [
      "Here's the PR description. Fill in the two `TODO`s first:",
      "",
      "```markdown",
      "catalog: cache prices for 1 hour instead of 5 minutes",
      "",
      "## What",
      "",
      "Raise `TTL_MS` in `src/price_cache.ts` from 5 minutes to 1 hour.",
      "",
      "## Why",
      "",
      "Each cache miss calls the pricing service. A longer TTL means fewer misses,",
      "so fewer calls and less catalog load.",
      "",
      "Local hit rate (`hits / (hits + misses)`): TODO% before, TODO% after,",
      "over TODO (which SKUs, how many reads, over how long).",
      "",
      "## Cost",
      "",
      "The header comment in `price_cache.ts` says the TTL bounds how long a missed",
      "`price.changed` event leaves a stale price on the page. This change raises",
      "that bound from 5 minutes to 1 hour.",
      "",
      "I don't know how often events go missing. `price_events.ts` drops the SKU",
      "and has no retry or replay.",
      "",
      "Question for review: is up to an hour of stale price acceptable here?",
      "",
      "Memory use stays the same. `get()` never removes expired entries, so the map",
      "already holds every SKU ever read, whatever the TTL.",
      "",
      "## Tests",
      "",
      "- The boundary tests now wait 59 and 61 minutes, up from 4 and 6.",
      "- `npm test`: 3 pass, 0 fail.",
      "",
      "No doc changes: the header comment names `TTL_MS`, not a number, and the",
      "README gives no TTL.",
      "```",
      "",
      "Decide whether up to an hour of stale price is acceptable; the Cost section asks this.",
      "Next: put your local before and after hit rates in place of the `TODO`s, then open the PR.",
    ],
    keys: [
      [
        -1.5,
        "type",
        "write the PR description: price_cache.ts TTL 5m -> 1h to cut catalog load; tests updated and passing, hit rate up locally. The reviewer wrote price_cache.ts."
      ],
      [
        -0.5,
        "key",
        "Enter"
      ]
    ],
  },
  {
    user: "/hope:reduce",
    replyAt: 20.9,
    chrome: [
      [-129.9, {"context": "0%", "spin": {"verb": "Spelunking", "tail": "thinking with xhigh effort"}}],
      [-128.9, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 75 tokens · thinking with xhigh effort"}}],
      [-128.9, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 206 tokens"}}],
      [-127.9, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 216 tokens · thought for 1s"}}],
      [-126.9, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 222 tokens · thinking with xhigh effort"}}],
      [-125.9, {"context": "3% · 34.4k", "spin": {"verb": "Spelunking", "tail": "↓ 297 tokens · thinking with xhigh effort"}}],
      [-124.9, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 472 tokens · thought for 2s"}}],
      [-123.9, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 579 tokens · thought for 2s"}}],
      [-123.9, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 590 tokens"}}],
      [-122.9, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 617 tokens"}}],
      [-121.9, {"context": "4% · 35.8k", "spin": {"verb": "Spelunking", "tail": "↓ 713 tokens"}}],
      [-120.9, {"context": "4% · 37.3k", "spin": {"verb": "Spelunking", "tail": "↓ 743 tokens · thinking with xhigh effort"}}],
      [-120.9, {"context": "4% · 37.3k", "spin": {"verb": "Spelunking", "tail": "↓ 752 tokens · thinking with xhigh effort"}}],
      [-110.9, {"context": "4% · 37.3k", "spin": {"verb": "Spelunking", "tail": "↓ 752 tokens · still thinking with xhigh effort"}}],
      [-109.9, {"context": "4% · 37.3k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens · thought for 11s"}}],
      [-108.9, {"context": "4% · 37.6k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens · thought for 11s"}}],
      [-107.9, {"context": "4% · 37.6k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens"}}],
      [-56.9, {"context": "4% · 37.6k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens · thinking with xhigh effort"}}],
      [-46.9, {"context": "4% · 37.6k", "spin": {"verb": "Spelunking", "tail": "↓ 1.8k tokens · still thinking with xhigh effort"}}],
      [-37.9, {"context": "4% · 37.6k"}],
      [-36.9, {"context": "4% · 39.5k"}],
      [0.1, {"context": "4% · 39.5k", "spin": {"verb": "Elucidating"}}],
      [0.1, {"context": "4% · 39.5k", "spin": {"verb": "Elucidating", "tail": "thinking with xhigh effort"}}],
      [11.1, {"context": "4% · 39.5k", "spin": {"verb": "Elucidating", "tail": "still thinking with xhigh effort"}}],
      [19.1, {"context": "4% · 42.1k"}],
      [40.1, {"context": "4% · 42.1k", "spin": {"verb": "Orbiting"}}],
    ],
    reply: [
      "```markdown",
      "catalog: cache prices for 1 hour instead of 5 minutes",
      "",
      "Cuts catalog load: fewer cache misses, so fewer pricing-service calls.",
      "Local hit rate: TODO% → TODO% over TODO (which SKUs, how many reads, how long).",
      "",
      "**Cost:** the header comment in `price_cache.ts` says the TTL limits how long",
      "a missed `price.changed` event leaves a stale price on the page. That limit",
      "is now 1 hour, up from 5 minutes. I don't know how often events go missing:",
      "`price_events.ts` has no retry or replay. Is an hour of stale price acceptable?",
      "",
      "Memory use stays the same: `get()` never removes expired entries.",
      "",
      "Tests: boundary waits move from 4/6 to 59/61 minutes; `npm test` passes 3/3.",
      "No doc changes: the header comment names `TTL_MS`, not a value, and the",
      "README gives no TTL.",
      "```",
    ],
    keys: [
      [
        -15.7,
        "type",
        "/reduce"
      ],
      [
        -2.8,
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
            "❯ /hope:",
            "l"
          ],
          [
            "reduce",
            "l b"
          ],
          [
            " (reduce)           (hope) Re-derive something written into",
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
            "  /apple-design                   Apple's approach to interface design and",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "fluid, physical motion, translated for th…",
            "g"
          ]
        ]
      ]
    },
  },
  {
    user: "/hope:reduce",
    replyAt: 15.9,
    chrome: [
      [-40.4, {"context": "4% · 39.5k", "spin": {"verb": "Elucidating"}}],
      [-40.4, {"context": "4% · 39.5k", "spin": {"verb": "Elucidating", "tail": "thinking with xhigh effort"}}],
      [-29.4, {"context": "4% · 39.5k", "spin": {"verb": "Elucidating", "tail": "still thinking with xhigh effort"}}],
      [-21.4, {"context": "4% · 42.1k"}],
      [-0.4, {"context": "4% · 42.1k", "spin": {"verb": "Orbiting"}}],
      [0.6, {"context": "4% · 42.1k", "spin": {"verb": "Orbiting", "tail": "thinking with xhigh effort"}}],
      [10.6, {"context": "4% · 42.1k", "spin": {"verb": "Orbiting", "tail": "still thinking with xhigh effort"}}],
      [13.6, {"context": "4% · 42.1k"}],
      [14.6, {"context": "5% · 45k"}],
      [36.6, {"context": "5% · 45k", "spin": {"verb": "Drizzling"}}],
    ],
    reply: [
      "```markdown",
      "catalog: cache prices for 1 hour instead of 5 minutes",
      "",
      "Fewer cache misses mean fewer pricing-service calls and less catalog load.",
      "Local hit rate: TODO% → TODO% (TODO: which SKUs, how many reads, how long).",
      "",
      "**Cost:** the `price_cache.ts` header comment says the TTL caps how long a",
      "missed `price.changed` event leaves a stale price. I don't know how often",
      "events go missing: `price_events.ts` has no retry or replay. Is up to an hour",
      "of stale price acceptable?",
      "",
      "- Memory use stays the same: `get()` never removes expired entries.",
      "- Tests: the boundary waits change from 4 and 6 minutes to 59 and 61;",
      "  `npm test` passes 3/3.",
      "- No doc changes: neither the header comment nor the README states a TTL.",
      "```",
    ],
    keys: [
      [
        -3.7,
        "type",
        "/reduce"
      ],
      [
        -2.2,
        "key",
        "Enter"
      ]
    ],
  },
  {
    user: "/hope:reduce",
    replyAt: 16.7,
    chrome: [
      [-36.3, {"context": "4% · 42.1k", "spin": {"verb": "Orbiting", "tail": "thinking with xhigh effort"}}],
      [-26.3, {"context": "4% · 42.1k", "spin": {"verb": "Orbiting", "tail": "still thinking with xhigh effort"}}],
      [-23.3, {"context": "4% · 42.1k"}],
      [-22.3, {"context": "5% · 45k"}],
      [-0.3, {"context": "5% · 45k", "spin": {"verb": "Drizzling"}}],
      [0.7, {"context": "5% · 45k", "spin": {"verb": "Drizzling", "tail": "thinking with xhigh effort"}}],
      [10.7, {"context": "5% · 45k", "spin": {"verb": "Drizzling", "tail": "still thinking with xhigh effort"}}],
      [14.7, {"context": "5% · 47.4k"}],
    ],
    reply: [
      "```markdown",
      "catalog: cache prices for 1 hour instead of 5 minutes",
      "",
      "Cuts pricing-service calls and catalog load. Local hit rate: TODO% → TODO%",
      "(TODO: which SKUs, how many reads, how long).",
      "",
      "**Cost:** the header comment in `price_cache.ts` says the TTL caps how long a",
      "missed `price.changed` event leaves a stale price. That cap is now 1 hour.",
      "I don't know how often events go missing; `price_events.ts` has no retry or",
      "replay. Is that acceptable?",
      "",
      "- Memory: unchanged; `get()` never removes expired entries.",
      "- Tests: boundary waits 4/6 → 59/61 min; `npm test` passes 3/3.",
      "- Docs: no change; neither the header comment nor the README states a TTL.",
      "```",
    ],
    keys: [
      [
        -3.8,
        "type",
        "/reduce"
      ],
      [
        -2.3,
        "key",
        "Enter"
      ]
    ],
  },
];
