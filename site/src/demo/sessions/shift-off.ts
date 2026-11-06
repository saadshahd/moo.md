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
      [1.4, {"context": "0%", "spin": {"verb": "Considering", "tail": "↓ 63 tokens"}}],
      [1.4, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 193 tokens"}}],
      [2.4, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 210 tokens"}}],
      [3.4, {"context": "4% · 35.2k", "spin": {"verb": "Considering", "tail": "↓ 217 tokens"}}],
      [22.4, {"context": "4% · 36k", "spin": {"verb": "Considering", "tail": "↓ 1.6k tokens"}}],
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
];
