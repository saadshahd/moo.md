import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "what size USB stick should I buy for the notes device?",
    tools: "Read 1 file, ran 1 shell command",
    activity: [
      {"at": 2.8, "line": "Running git ls-files && cat hardware/parts.md && grep -rn…", "tool": "$ git ls-files && cat hardware/parts.md && grep -rn -iE \"opus|bitrate|rate|channels|max|limit|seconds|duration|fat|exfat|mount|retention|delete\" software --include=*.py | grep -v test | head -60"},
      {"at": 4.8, "line": "Running git ls-files && cat hardware/parts.md && grep -rn…", "tool": "$ cat software/audio.py software/store.py README.md hardware/enclosure/parameters.json"},
    ],
    replyAt: 22.6,
    chrome: [
      [-2.2, {"context": "0%"}],
      [-0.2, {"context": "0%", "spin": {"verb": "Vibing"}}],
      [0.8, {"context": "0%", "spin": {"verb": "Accomplishing", "tail": "↓ 38 tokens · thinking with medium effort"}}],
      [1.8, {"context": "4% · 35.2k", "spin": {"verb": "Accomplishing", "tail": "↓ 187 tokens · thinking with medium effort"}}],
      [2.8, {"context": "4% · 35.2k", "spin": {"verb": "Accomplishing", "tail": "↓ 221 tokens · thought for 1s"}}],
      [2.8, {"context": "4% · 35.2k", "spin": {"verb": "Accomplishing", "tail": "↓ 231 tokens · thought for 1s"}}],
      [3.8, {"context": "4% · 35.2k", "spin": {"verb": "Accomplishing", "tail": "↓ 234 tokens · thought for 1s"}}],
      [4.8, {"context": "4% · 35.8k", "spin": {"verb": "Accomplishing", "tail": "↓ 310 tokens"}}],
      [5.8, {"context": "4% · 35.8k", "spin": {"verb": "Accomplishing", "tail": "↓ 322 tokens · thinking with medium effort"}}],
      [5.8, {"context": "4% · 35.8k", "spin": {"verb": "Accomplishing", "tail": "↓ 324 tokens · thinking with medium effort"}}],
      [14.8, {"context": "4% · 35.8k", "spin": {"verb": "Accomplishing", "tail": "↓ 324 tokens · still thinking with medium effort"}}],
      [22.8, {"context": "4% · 37.6k"}],
    ],
    reply: [
      "**Buy a 64 GB low-profile stick, such as a SanDisk Ultra Fit or a similar nub-style stick from a known brand.** Size barely matters for storing the notes. The other features of the stick matter more.",
      "",
      "**How much space notes need.** `software/audio.py` records mono Opus at 48 kHz and leaves the bitrate to opusenc. I believe opusenc's default for mono is about 64 kbit/s, but I haven't checked that on the Pi. At that rate, recordings take about 29 MB per hour. WhatsApp notes your dad receives use a lower bitrate, so they take less space.",
      "",
      "| Use | Per year | 32 GB fills in | 64 GB fills in |",
      "| --- | --- | --- | --- |",
      "| 20 min of notes a day | ~3.5 GB | ~8 years | ~16 years |",
      "| 1 hour a day (heavy) | ~10.5 GB | ~2.5 years | ~5 years |",
      "",
      "**Why 64 GB and not 32 GB.** The README says notes are kept for good. In fact, `store.py` deletes the oldest notes once the stick is 90% full. With heavy use, a 32 GB stick reaches that point while the box is still sealed. 64 GB costs about the same and pushes it well past the box's life. Going above 128 GB gains nothing.",
      "",
      "**What matters more than size:**",
      "- **Shape.** The case leaves 40 mm past the USB ports (`usb_plug_room`). Ordinary sticks are 40–60 mm long, so they won't fit. A nub-style stick sticks out about 15 mm.",
      "- **Reliability.** Nobody will open the box for years, so a dead stick means losing every note. Buy a known brand from a trusted seller, because fake-capacity sticks are common on marketplaces. Notes are small and written rarely, so speed and wear don't matter.",
      "- **Filesystem.** Before sealing the box, think about formatting the stick as ext4 rather than the FAT it ships with. ext4 copes better with power cuts in the middle of a write. This is a recommendation, not something the code requires.",
      "",
      "I haven't changed `hardware/parts.md`. Its status column records when a part arrives, so it should be updated once the stick is in hand.",
    ],
    keys: [
      [
        -2.1,
        "type",
        "what size USB stick should I buy for the notes device?"
      ],
      [
        -0.1,
        "key",
        "Enter"
      ]
    ],
  },
  {
    user: "/hope:inversion",
    replyAt: 11.5,
    chrome: [
      [-61.1, {"context": "0%", "spin": {"verb": "Accomplishing", "tail": "↓ 38 tokens · thinking with medium effort"}}],
      [-60.1, {"context": "4% · 35.2k", "spin": {"verb": "Accomplishing", "tail": "↓ 187 tokens · thinking with medium effort"}}],
      [-59.1, {"context": "4% · 35.2k", "spin": {"verb": "Accomplishing", "tail": "↓ 221 tokens · thought for 1s"}}],
      [-59.1, {"context": "4% · 35.2k", "spin": {"verb": "Accomplishing", "tail": "↓ 231 tokens · thought for 1s"}}],
      [-58.1, {"context": "4% · 35.2k", "spin": {"verb": "Accomplishing", "tail": "↓ 234 tokens · thought for 1s"}}],
      [-57.1, {"context": "4% · 35.8k", "spin": {"verb": "Accomplishing", "tail": "↓ 310 tokens"}}],
      [-56.1, {"context": "4% · 35.8k", "spin": {"verb": "Accomplishing", "tail": "↓ 322 tokens · thinking with medium effort"}}],
      [-56.1, {"context": "4% · 35.8k", "spin": {"verb": "Accomplishing", "tail": "↓ 324 tokens · thinking with medium effort"}}],
      [-47.1, {"context": "4% · 35.8k", "spin": {"verb": "Accomplishing", "tail": "↓ 324 tokens · still thinking with medium effort"}}],
      [-39.1, {"context": "4% · 37.6k"}],
      [-22.1, {"context": "4% · 37.6k", "style": "hold:Plain"}],
      [-0.1, {"context": "4% · 37.6k", "style": "hold:Plain", "spin": {"verb": "Schlepping"}}],
      [0.9, {"context": "4% · 37.6k", "style": "hold:Plain", "spin": {"verb": "Recombobulating", "tail": "thinking with medium effort"}}],
      [7.9, {"context": "5% · 45.4k", "style": "hold:Plain"}],
    ],
    reply: [
      "Buy and set up the stick this way:",
      "",
      "- Buy a nub-style stick about 15 mm long.",
      "- It fits the case's 40 mm of room past the USB ports.",
      "- Buy it from the brand's own store or a major retailer, not a marketplace seller.",
      "- Run `f3write` and `f3read` on it to confirm its real size before it goes in the box.",
      "- Format it ext4.",
      "- ext4 keeps the disk intact if power cuts mid-write.",
      "- Mount it in `/etc/fstab` by UUID.",
      "- Make `Store` refuse to start when its root isn't a mount point.",
      "- Without that check, notes go to the SD card.",
      "- The next update wipes notes kept on the SD card.",
      "- Before you seal the box, fill the stick to 90% so `prune` runs.",
      "- Then record and play a note.",
      "- Copy the notes off the box on a schedule.",
      "- The stick is the only copy.",
      "",
      "Next: order the stick, then add the mount-point check to `software/store.py`.",
    ],
    keys: [
      [
        -2.7,
        "type",
        "/hope:inversion"
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
            "hope:inversion",
            "l b"
          ],
          [
            "                 (hope) Find the route to guaranteed",
            "l"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "failure, negate it. Use when a goal keeps…",
            "l"
          ]
        ],
        [
          [
            "  "
          ],
          [
            "  /hope:interrogate               (hope) Make the user defend a proposal",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "they committed to. Use when a proposal is…",
            "g"
          ]
        ]
      ]
    },
  },
];
