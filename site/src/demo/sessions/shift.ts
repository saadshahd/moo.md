import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "Help me name the parts of the /fly idea in notes/ideas.md, so it can replace relay.",
    tools: "Listed 1 directory",
    activity: [
      {"at": 1.4, "line": "Reading ideas notes and relay skill", "tool": "$ cat notes/ideas.md && ls skills && cat skills/relay/SKILL.md && cat skills/relay/RUNS.md"},
    ],
    replyAt: 22.8,
    chrome: [
      [-2.6, {"context": "0%"}],
      [-0.6, {"context": "0%", "spin": {"verb": "Gitifying"}}],
      [1.4, {"context": "0%", "spin": {"verb": "Considering", "tail": "↓ 63 tokens · thinking with medium effort"}}],
      [1.4, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 193 tokens"}}],
      [2.4, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 210 tokens · thought for 1s"}}],
      [3.4, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 217 tokens · thinking with medium effort"}}],
      [13.4, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 217 tokens · still thinking with medium effort"}}],
      [22.4, {"context": "4% · 36k", "spin": {"verb": "Considering", "tail": "↓ 1.6k tokens · thought for 19s"}}],
      [23.4, {"context": "4% · 36k"}],
    ],
    reply: [
      "I don't think the problem is which flight words to pick. Your Run 2 note says \"lane, scope, park, contract: these aren't my words.\" Renaming lane→track and park→hold didn't fix it either: both runs failed the same two gates. So I'd take names only from your own /fly paragraph, and leave a part unnamed until you have a word for it. I haven't edited anything yet.",
      "",
      "**Names your paragraph already gives**",
      "",
      "| relay part | /fly name | your words |",
      "|---|---|---|",
      "| goal | **the thought** | \"a simple unclear thought\" |",
      "| brief (scope, done-when) | **the destination** | \"it has a destination\" |",
      "| retiring the brief | **landing** | \"lands it safely\" |",
      "| the whole session | **the journey** | \"on the journey\", \"day-long session\" |",
      "| whoever runs the session | whoever **drives** | \"plane-driving\" |",
      "",
      "You wrote \"drives\", not \"pilots\", which suggests you don't think in flight jargon. So I'd keep out \"crew\", \"manifest\", \"cockpit\" and \"tower\".",
      "",
      "**Your rules already cover both relay failures**",
      "",
      "- **No magic:** nothing happens without being said. In Run 1 the lead did a lane's work itself and didn't mention it. That's magic.",
      "- **No skips:** every step gets reported, and a missing report counts as a problem. In Run 1, 4 of 5 reports never arrived and nothing errored. That's a skip.",
      "",
      "Those two lines could replace relay's gates outright. They're the two things you'd watch for during a run.",
      "",
      "**Parts with no word of yours yet**",
      "",
      "1. **One slice of the work, held by one agent or by you** (relay's \"lane\"). Your idea says the work is shared by humans and agents, so the name has to fit either one.",
      "2. **What comes back when a slice is done** (relay's \"report\" or \"contract\"). You stopped reading the scratchpad handovers because they were too noisy. What would you actually read?",
      "3. **Stopping a slice and coming back later** (relay's \"park\"). Does /fly need this at all? \"No skips\" might mean nothing gets set aside quietly.",
      "",
      "My suggestion: for each of those three, say out loud how you'd tell a colleague about it mid-session, and use those exact words. Tell me them and I'll write `skills/fly/SKILL.md` with your names, and handle `skills/relay` in the same change rather than keeping both.",
    ],
    keys: [
      [
        -2.1,
        "type",
        "Help me name the parts of the /fly idea in notes/ideas.md, so it can replace relay."
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
  {
    user: "/hope:shift",
    replyAt: 25.7,
    chrome: [
      [-52.2, {"context": "0%", "spin": {"verb": "Gitifying"}}],
      [-51.2, {"context": "0%", "spin": {"verb": "Considering", "tail": "↓ 63 tokens · thinking with medium effort"}}],
      [-51.2, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 193 tokens"}}],
      [-50.2, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 210 tokens · thought for 1s"}}],
      [-49.2, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 217 tokens · thinking with medium effort"}}],
      [-39.2, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 217 tokens · still thinking with medium effort"}}],
      [-30.2, {"context": "4% · 36k", "spin": {"verb": "Considering", "tail": "↓ 1.6k tokens · thought for 19s"}}],
      [-29.2, {"context": "4% · 36k"}],
      [-16.2, {"context": "4% · 36k", "style": "hold:Plain"}],
      [-0.2, {"context": "4% · 36k", "style": "hold:Plain", "spin": {"verb": "Gesticulating"}}],
      [0.8, {"context": "4% · 36k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "thinking with medium effort"}}],
      [10.8, {"context": "4% · 36k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "still thinking with medium effort"}}],
      [20.8, {"context": "4% · 36k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "thinking more with medium effort"}}],
      [22.8, {"context": "4% · 44.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 1.7k tokens · thought for 22s"}}],
      [22.8, {"context": "4% · 44.1k", "style": "hold:Plain"}],
    ],
    reply: [
      "Here's the problem as a busy restaurant kitchen:",
      "",
      "```",
      "1. A guest gives the chef a vague order: \"something warm, not heavy.\"",
      "2. Chef writes the ticket: the dish, and how the plate must look to leave.",
      "3. Chef calls each part out loud to a station: \"fire two sauces.\"",
      "4. Each station shouts \"heard\" at once; a silent station is an alarm now.",
      "5. Chef keeps calling the open count, \"three sauces all day\", so all hear it.",
      "6. Every part comes to the pass, and the chef looks at the plate itself.",
      "7. Chef never cooks at a station unseen; if chef steps in, chef says so.",
      "8. A part that can't come out gets 86'd out loud, and the ticket changes.",
      "9. The dish leaves the pass only when it matches the ticket.",
      "```",
      "",
      "A kitchen confirms each job when it is handed out, not at the end.",
      "It states the open count aloud; relay waited until the end.",
      "",
      "Next: tell me which of \"heard\", \"all day\" and \"the pass\" you would actually say during a session.",
    ],
    keys: [
      [
        -2.7,
        "type",
        "/hope:shift"
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
            "hope:shift",
            "l b"
          ],
          [
            "                     (hope) Restate the problem in a distant",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "domain's terms. Use when a problem circle…",
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
