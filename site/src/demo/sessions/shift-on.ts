import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:shift Help me name the parts of the /fly idea in notes/ideas.md, so it can replace relay.",
    tools: "Listed 1 directory",
    activity: [
      {"at": 1.9, "line": "Running cat notes/ideas.md; ls skills; ls skills/relay; c…", "tool": "$ cat notes/ideas.md; ls skills; ls skills/relay; cat skills/relay/SKILL.md; cat skills/relay/RUNS.md"},
    ],
    replyAt: 34.4,
    chrome: [
      [-3.1, {"context": "0%", "style": "hold:Plain"}],
      [-1.1, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Topsy-turvying"}}],
      [1.9, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": ""}}],
      [1.9, {"context": "4% · 37.9k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 113 tokens"}}],
      [2.9, {"context": "4% · 37.9k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 196 tokens"}}],
      [3.9, {"context": "4% · 37.9k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 206 tokens"}}],
      [3.9, {"context": "4% · 37.9k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 208 tokens"}}],
      [33.9, {"context": "4% · 37.9k", "style": "hold:Plain", "spin": {"verb": "Hatching", "tail": "↓ 2.5k tokens"}}],
      [34.9, {"context": "4% · 38.7k", "style": "hold:Plain"}],
    ],
    reply: [
      "Aviation names /fly's parts, and its words add new parts rather than renaming relay's:",
      "",
      "| part | what happens |",
      "|---|---|",
      "| passenger | the rough thought, bound for a place it can't yet name |",
      "| flight plan | destination, alternate, and divert point |",
      "| release | the dispatcher signs the plan; no signature, no pushback |",
      "| sector | one stretch of airspace that one controller works |",
      "| handoff | the next controller says \"radar contact\" before the last lets go |",
      "| \"I have control\" | said aloud; nobody takes the controls without saying it |",
      "| reporting point | a fix where the flight must call in |",
      "| overdue | a missed call starts the search at once |",
      "| hold | circle a named fix, with a time for the next clearance |",
      "| strip | one card per flight on the controller's board |",
      "| block-in | the passenger is at the gate; the flight closes |",
      "",
      "Aviation treats silence as an alarm; relay has no word that fires when something goes missing.",
      "Next: say go and I'll draft `skills/fly/SKILL.md` from these rows and retire relay.",
    ],
    keys: [
      [
        -2.3,
        "type",
        "/hope:shift Help me name the parts of the /fly idea in notes/ideas.md, so it can replace relay."
      ],
      [
        -0.4,
        "key",
        "Enter"
      ]
    ],
  },
];
