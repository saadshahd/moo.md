import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:judge Do we need the Y-cable in notes/parts.md?",
    tools: "Listed 1 directory, ran 2 shell commands",
    activity: [
      {"at": 9.3, "line": "Running cat -n notes/parts.md && ls logs && cat -n src/pl…", "tool": "$ cat -n notes/parts.md && ls logs && cat -n src/player.py | head -80"},
      {"at": 14.3, "line": "Running cd /Users/Shared/chimebo**2**/logs && cat README.md; …", "tool": "$ cd /Users/Shared/chimebox/logs && cat README.md; grep -niE \"voltage|over-current|overcurrent|disconnect|usb|underrun|throttl|ready\" *.log | head -80; wc -l *.log"},
      {"at": 21.3, "line": "Running sed -n **5**,**17**p boot-**02**-**2026**-**10**-**14**.log; sed -n **8**,**9**p …", "tool": "$ sed -n 5,17p boot-02-2026-10-14.log; sed -n 8,9p boot-05-2026-10-21.log"},
    ],
    replyAt: 30.4,
    chrome: [
      [-2.7, {"context": "0%", "style": "hold:Plain"}],
      [-0.7, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Precipitating"}}],
      [8.3, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Bunning"}}],
      [9.3, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 19 tokens"}}],
      [10.3, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 80 tokens"}}],
      [10.3, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 90 tokens"}}],
      [11.3, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 93 tokens"}}],
      [13.3, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 181 tokens"}}],
      [14.3, {"context": "4% · 38.9k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 305 tokens"}}],
      [15.3, {"context": "4% · 38.9k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 320 tokens"}}],
      [15.3, {"context": "4% · 38.9k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 324 tokens"}}],
      [21.3, {"context": "4% · 43.9k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 499 tokens"}}],
      [21.3, {"context": "4% · 43.9k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 662 tokens"}}],
      [22.3, {"context": "4% · 43.9k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 725 tokens"}}],
      [23.3, {"context": "4% · 43.9k", "style": "hold:Plain", "spin": {"verb": "Bunning", "tail": "↓ 735 tokens"}}],
      [30.3, {"context": "4% · 44.9k", "style": "hold:Plain"}],
    ],
    reply: [
      "No: the speaker runs fine on the Pi's own port.",
      "`player.py` causes the stuck loop because it never reopens the speaker.",
      "",
      "| fact | where |",
      "|---|---|",
      "| Max volume all afternoon, speaker plugged in at boot: \"309 presses played, 0 errors\" | `logs/boot-05-2026-10-21.log:8` |",
      "| Stuck boot, speaker plugged in late: trips once, back within 1 s | `logs/boot-02-2026-10-14.log:10-16` |",
      "| Same stuck boot: \"Broken pipe\" repeats 3982 times | `logs/boot-02-2026-10-14.log:10-16` |",
      "| Retry loop writes to the dead handle and never reopens `plughw:S2` | `src/player.py:17-21` |",
      "",
      "Each stuck boot logs \"ALSA: cannot open…; retrying.\"",
      "`player.py` never prints that, so the box runs a different version.",
      "",
      "Next: drop the Y-cable from `notes/parts.md`.",
      "Then make `play()` reopen the speaker after a disconnect.",
    ],
    keys: [
      [
        -2.5,
        "type",
        "/hope:judge Do we need the Y-cable in notes/parts.md?"
      ],
      [
        -0.6,
        "key",
        "Enter"
      ]
    ],
  },
];
