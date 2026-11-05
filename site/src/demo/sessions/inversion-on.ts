import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:inversion what size USB stick should I buy for the notes device?",
    tools: "Read 1 file, ran 1 shell command",
    activity: [
      {"at": 3.0, "line": "Running git ls-files && cat hardware/parts.md && cat READ…", "tool": "$ git ls-files && cat hardware/parts.md && cat README* 2>/dev/null | head -50; grep -rn -iE \"opus|bitrate|usb|mount|vfat|fat|exfat|ext4|rate|sample|bytes|size|limit|delete|prune\" software --include=*.py | head -60"},
      {"at": 5.0, "line": "Running git ls-files && cat hardware/parts.md && cat READ…", "tool": "$ cat software/audio.py software/store.py hardware/enclosure/parameters.json"},
    ],
    replyAt: 26.1,
    chrome: [
      [-13.0, {"context": "0%", "style": "hold:Plain"}],
      [-11.0, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Cascading"}}],
      [1.0, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "thinking with medium effort"}}],
      [1.0, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "↓ 50 tokens · thinking with medium effort"}}],
      [2.0, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "↓ 190 tokens · thinking with medium effort"}}],
      [3.0, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "↓ 227 tokens · thought for 1s"}}],
      [4.0, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "↓ 238 tokens · thought for 1s"}}],
      [4.0, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "↓ 240 tokens · thought for 1s"}}],
      [5.0, {"context": "4% · 37.8k", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "↓ 240 tokens"}}],
      [6.0, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "↓ 318 tokens"}}],
      [7.0, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "↓ 330 tokens · thinking with medium effort"}}],
      [16.0, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Undulating", "tail": "↓ 330 tokens · still thinking with medium effort"}}],
      [26.0, {"context": "4% · 40.2k", "style": "hold:Plain"}],
    ],
    reply: [
      "Buy a 64 GB low-profile stick, such as a SanDisk Ultra Fit (about 30 mm long).",
      "",
      "- Buy 64 GB or more. It holds about 2,000 hours of notes at opusenc's default ~64 kbit/s mono.",
      "- Buy a stick shorter than 40 mm, the room the case leaves past the USB ports (`usb_plug_room` in `hardware/enclosure/parameters.json`).",
      "- Buy from the maker's own store or a large retailer. Fake-capacity sticks lose data without warning.",
      "- Run `f3write` then `f3read` before you seal the case.",
      "- Format it ext4, not FAT, so a power cut does not damage `index.db`.",
      "",
      "Order the stick, then set its row in `hardware/parts.md` to \"arrived\" when it comes.",
    ],
    keys: [
      [
        -12.3,
        "type",
        "/hope:inversion what size USB stick should I buy for the notes device?"
      ],
      [
        -10.4,
        "key",
        "Enter"
      ]
    ],
  },
];
