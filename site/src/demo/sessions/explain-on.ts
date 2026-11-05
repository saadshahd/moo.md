import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:explain the left ear follows the right / the sudden squeaks are annoying, what are these?",
    tools: "Listed 1 directory, ran 2 shell commands",
    activity: [
      {"at": 2.8, "line": "Listing repo files and read notes", "tool": "$ git ls-files | head -50 && cat CLAUDE.md notes/voice.md 2>/dev/null; wc -l scripts/midi/*.py"},
      {"at": 6.8, "line": "Listing repo files and read notes", "tool": "$ cat scripts/midi/*.py; cat songs/03-night-drive/renders/midi/transcribe.log songs/03-night-drive/renders/stems/README.md; cat songs/03-night-drive/renders/midi/lead-vocal.notes.csv; cat .gitignore; ls -R songs"},
      {"at": 18.8, "line": "Inspecting check wav channels and high notes", "tool": "$ cd /Users/Shared/songbook/songs/03-night-drive/renders/midi && python3 - <<'E'\nimport wave,struct,array\nw=wave.open('lead-vocal-check.wav');print(w.getparams())\nn=w.getnframes();d=array.array('h',w.readframes(n))\nch=w.getnchannels()\nL=d[0::ch];R=d[1::ch] if ch>1 else []\nprint('maxL',max(map(abs,L)),'maxR',max(map(abs,R)) if R else None)\nr=w.getframerate()\nclip=sum(1 for s in L if abs(s)>=32767);print('clipped L samples',clip)\n# energy per 0.5s of R\nprint([round(sum(abs(x) for x in R[i:i+r//2])/(r//2)) for i in range(0,min(len(R),r*10),r//2)])\nE\npython3 -c \"\nimport csv\nrows=list(csv.DictReader(open('lead-vocal.notes.csv')))\nfor i,r in enumerate(rows):\n  m=int(r['midi']);s=float(r['start_s']);e=s+float(r['dur_s'])\n  ov=[x['note'] for x in rows if x is not r and float(x['start_s'])<e and float(x['start_s'])+float(x['dur_s'])>s]\n  if m>=67: print(r['start_s'],r['note'],r['voiced_prob'],'overlaps',ov)\n\"; cat ../../prompt.md ../../lyrics.md | head -40"},
    ],
    replyAt: 38.8,
    chrome: [
      [-3.2, {"context": "0%", "style": "hold:Plain"}],
      [-1.2, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Beboppin'"}}],
      [1.8, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "thinking with medium effort"}}],
      [1.8, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 88 tokens · thinking with medium effort"}}],
      [2.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 192 tokens"}}],
      [3.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 209 tokens · thought for 1s"}}],
      [3.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 217 tokens · thought for 1s"}}],
      [5.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 233 tokens"}}],
      [6.8, {"context": "4% · 38.1k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 293 tokens"}}],
      [6.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 400 tokens"}}],
      [7.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 411 tokens · thinking with medium effort"}}],
      [8.8, {"context": "4% · 38.8k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 415 tokens · thinking with medium effort"}}],
      [13.8, {"context": "5% · 46.2k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 528 tokens · thought for 5s"}}],
      [13.8, {"context": "5% · 46.2k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 715 tokens · thought for 5s"}}],
      [14.8, {"context": "5% · 46.2k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 890 tokens · thought for 5s"}}],
      [15.8, {"context": "5% · 46.2k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 1.0k tokens"}}],
      [16.8, {"context": "5% · 46.2k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 1.1k tokens"}}],
      [18.8, {"context": "5% · 46.2k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 1.2k tokens"}}],
      [19.8, {"context": "5% · 46.2k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 1.4k tokens"}}],
      [20.8, {"context": "5% · 46.2k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 1.5k tokens · thinking with medium effort"}}],
      [30.8, {"context": "5% · 46.2k", "style": "hold:Plain", "spin": {"verb": "Swirling", "tail": "↓ 1.5k tokens · still thinking with medium effort"}}],
      [38.8, {"context": "5% · 48k", "style": "hold:Plain"}],
    ],
    reply: [
      "The squeaks are 11 wrong notes from the transcription, all far above your singer's range.",
      "",
      "**Where they are** (`lead-vocal.notes.csv`)",
      "",
      "| time | squeak notes | sounding at the same time |",
      "|---|---|---|",
      "| 1:01 | D5, D#5 | B3, A#3 |",
      "| 1:14–1:17 | D5, A#4, B4, G4, G4 | G3, D#3, F#4, E4 |",
      "| 1:38 | B4, A#4 | each other |",
      "| 2:38 | E5, D5 | A3, F#3, F3 |",
      "",
      "**Why they're wrong**",
      "",
      "```text",
      "squeak note, e.g. 1:14 B4",
      "├─ above D#4, the top of your voice     # notes/voice.md: D3–D#4",
      "├─ starts while G3 is still sounding    # one voice sings one note",
      "└─ voiced_prob 0.54 or lower            # pyin is unsure of every note here",
      "cause                                   [open] backing vocals bleeding in, or pyin misreading",
      "```",
      "",
      "The check file's right ear holds no voice: `preview.py:23` writes 0 there.",
      "Your right-ear voice must come from another player.",
      "",
      "Play `0 Lead Vocal.wav` at 1:14 and tell me if you hear a high harmony.",
      "That decides whether we drop these notes.",
    ],
    keys: [
      [
        -2.5,
        "type",
        "/hope:explain the left ear follows the right / the sudden squeaks are annoying, what are these?"
      ],
      [
        -0.6,
        "key",
        "Enter"
      ]
    ],
  },
];
