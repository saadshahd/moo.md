// What a demo plays: turns of a real recorded Claude Code session.

/** One logical line as Claude Code drew it: **bold**, `code`, *italic*, leading
 * spaces for indent, "- " or "1. " for list items. Blank is an empty string. */
export type Line = string;

/** One recorded turn, its reply complete. A fenced block draws as Claude Code drew it: no language in lavender, "diff"
 * with + lines green and - lines red, any other plain. */
export type Turn = {
  /** The prompt as Claude Code shows it once sent, e.g. "/hope:freeze …". */
  user: string;
  /** The collapsed tool summary row under the prompt, if Claude Code drew one. */
  tools?: string;
  /** The user pressed Esc: Claude Code's grey "Interrupted" row under the tools. */
  interrupted?: true;
  /** The activity lines focus mode showed while Claude worked, in order. */
  activity?: Activity[];
  /** The AskUserQuestion dialogs the turn opened before its reply, in order. */
  dialogs?: Dialog[];
  /** The toast hunch showed once the reply was in, e.g. tend's. */
  toast?: string;
  /** The keys the recorder sent, from its key log, in order: seconds after
   * the prompt was sent (negative before), "key" and the key's name ("Enter",
   * "Down", "n"), or "type" and the text, which lands whole. The keys before
   * the prompt was sent type and send it; the rest drive the dialogs. */
  keys: [number, "key" | "type", string][];
  /** The slash menu Claude Code drew over the prompt box after key `after`
   * until the next key, as captured at 80 columns: each row's runs of text
   * and their classes. */
  menu?: { after: number; rows: [string, string?][][] };
  /** Seconds after the prompt was sent when the reply came in. */
  replyAt: number;
  /** What Claude Code drew around the prompt from each moment on: seconds
   * after the prompt was sent (negative while it was typed), read from the
   * screens captured while the turn ran. */
  chrome: [number, Chrome][];
  reply: Line[];
};

/** What Claude Code drew around the prompt box at one moment. */
export type Chrome = {
  /** The status line's context use: "0%", or "4% · 35.1k". */
  context: string;
  /** The output style the status line names at its right, e.g. "hold:Plain";
   * none when Claude Code ran without one. */
  style?: string;
  /** The spinner's verb, and its words after the counter, e.g. "↓ 232 tokens"
   * (none: Claude Code showed no counter yet). */
  spin?: { verb: string; tail?: string };
};

/** One activity line and the tool line under it, from `at` seconds after the
 * prompt was sent. A Skill call shows no label of its own: `move` names the
 * skill, and `line` is the counted summary, counts in **bold**. */
export type Activity = {
  at: number;
  line: Line;
  /** The newest tool's line: "$ " and the command, a path, or a pattern. */
  tool?: string;
  move?: string;
};

/** One question of an AskUserQuestion dialog, and how the recorder answered. */
export type Question = {
  header: string;
  question: string;
  multiSelect: boolean;
  /** `preview`: what the option builds, drawn in a box beside the options
   * while the cursor is on it. Any option with one draws the question that way. */
  options: { label: string; description: string; preview?: string }[];
  /** The options picked, by index, in the order they were picked. */
  picked: number[];
  /** Words typed into "Type something", if any. */
  typed?: string;
  /** Notes added to the pick with n, on a question with previews. */
  notes?: string;
};

/** A dialog as Claude Code drew it, from the session file. */
export type Dialog = {
  /** Seconds after the prompt was sent when it opened and when it was answered. */
  at: [number, number];
  /** The grey line under the dialog's activity line: the last tool's, e.g. "$ cal 11 2026". */
  tool?: string;
  /** How many of the turn's activity lines showed before it opened. */
  after: number;
  questions: Question[];
};

/** A caption above the terminal that narrates the demo. It takes over as turn
 * `at` starts typing; with `on: "move"` as its activity reaches skill call `n`
 * (counting from 0); with `on: "dialog"` as its dialog `d` (default 0) shows
 * question `q`; with `on: "reply"` as its reply arrives. */
export type Beat =
  | { at: number; on?: "reply"; text: string }
  | { at: number; on: "move"; n: number; text: string }
  | { at: number; on: "dialog"; d?: number; q: number; text: string };

export type Scene = {
  /** What Claude Code drew around the prompt box before the first prompt. */
  chrome: Chrome;
  turns: Turn[];
  /** In the order they play; the first opens the demo. */
  beats: Beat[];
  /** The turn Claude Code ran with all of moo off, if the recording has one.
   * The turn after it runs the move, and the demo opens paused on that turn's
   * reply, moo's hand-back; one step back, labelled "without moo", shows this
   * turn's reply. */
  plain?: number;
};
