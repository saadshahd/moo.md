// Claude Code's terminal as recorded (v2.1.316): rows of styled segments, built
// for any column count, and one clock that says what is on screen at time t.
import type { Activity, Chrome, Dialog, Line, Scene, Turn } from "./types";
import { layout, MEASURE, type Band, type Cell as BandCell, type Item } from "./band";

/** The terminal's height in rows, as recorded: dialogs are laid out for it
 * (a preview's rows fit under it; a taller dialog shows its last rows). The
 * player may show fewer rows; a dialog taller than those shows its last. */
export const ROWS = 36;

/** The column counts a pane draws at, each one check.sh holds the demos to
 * against the recorder's captures. Demo.astro picks the widest whose pair
 * fits the page. */
export const COLS = [45, 80, 120] as const;

/** The pane the clock is timed at, whatever size a page draws: a dialog
 * holds for the words it shows here, so a resize never moves a wait. 45 is
 * the widest recorded width a phone holds. A pane draws as many rows as the
 * screen's height leaves it (Demo.astro), never fewer than these, so no pane
 * hides words a hold counted on; a window too short for 26 rows, under
 * 670px tall, scrolls the page. */
export const PANE = { cols: 45, rows: 26 };

/** A run of text and the classes that color it (see Demo.astro's styles),
 * and what a click on it does, if it is one of tend's buttons: its item's id,
 * e.g. "chip:questions" or "close". */
export type Seg = [string, string?, string?];
/** `opt`: the dialog option the row draws, which the reader can pick;
 * `input`: the column of the text cursor, on the row of a field being typed in. */
export type Row = { segs: Seg[]; cls?: string; opt?: number; input?: number };
type Cell = [string, string?];

// ---- Wrapping ---------------------------------------------------------------
// Greedy by words. As in wrapInk, the space after a row that fills its width
// starts the next row, so that row holds one column less, and counts toward
// filling it; Claude Code then draws the row without the space. A word longer
// than the width starts on the row it follows when that breaks it no more
// often than starting a new row would (wrap-ansi's rule), and breaks at the
// edge with no space carried; a shorter word is never broken, even on a first
// row narrower than the width.
function wrap(cs: Cell[], width: number, first = width): Cell[][] {
  const lines: Cell[][] = [];
  let line: Cell[] = [];
  let i = 0;
  // Whether each row so far began with a carried space, and whether it ended
  // inside a word.
  const carried: boolean[] = [];
  const broke: boolean[] = [];
  const room = () => {
    const n = lines.length;
    const limit = (k: number) => (k ? width : first);
    const carry = n > 0 && !broke[n - 1] && lines[n - 1].length + (carried[n - 1] ? 1 : 0) >= limit(n - 1);
    carried[n] = carry;
    return limit(n) - (carry ? 1 : 0);
  };
  while (i < cs.length) {
    const from = i;
    while (i < cs.length && cs[i][0] === " ") i++;
    // Spaces between words close up to one, but a run inside code stays.
    const run = cs.slice(from, i);
    const gap: Cell[] = run.length > 1 && run.every((c) => /\bl\b/.test(c[1] ?? "")) ? run : [[" "]];
    let j = i;
    while (j < cs.length && cs[j][0] !== " ") j++;
    if (i === j) break;
    const word = cs.slice(i, j);
    if (line.length && line.length + gap.length + word.length > room()) {
      const left = room() - line.length - 1;
      const stay =
        word.length > width && left > 0 &&
        Math.floor((word.length - 1) / width) >= 1 + Math.floor((word.length - left - 1) / width);
      if (!stay) {
        lines.push(line);
        line = [];
      }
    }
    if (line.length) line.push(...gap);
    line.push(...word);
    while (word.length > width && line.length > room()) {
      const r = room();
      broke[lines.length] = true;
      lines.push(line.slice(0, r));
      line = line.slice(r);
    }
    i = j;
  }
  return [...lines, line];
}

// Ink's wrap, for what Claude Code lays out in boxes and code blocks (wrap-ansi
// with trim off): a line's leading spaces stay on its first row, the space
// before a word that moves down ends the row above, and a word longer than the
// width breaks at the edge, or, not `hard`, takes a row of its own whole.
// Matches the recorded dialogs at 45, 80 and 120.
function wrapInk(cs: Cell[], width: number, hard = true): Cell[][] {
  const words: Cell[][] = [[]];
  const spaces: Cell[] = [];
  for (const c of cs) {
    if (c[0] !== " ") words[words.length - 1].push(c);
    else (spaces.push(c), words.push([]));
  }
  const rows: Cell[][] = [[]];
  const row = () => rows[rows.length - 1];
  words.forEach((word, k) => {
    if (k) {
      if (row().length >= width) rows.push([]);
      row().push(spaces[k - 1]);
    }
    if (hard && word.length > width) {
      const here =
        1 + Math.floor((word.length - (width - row().length) - 1) / width);
      if (Math.floor((word.length - 1) / width) < here) rows.push([]);
      word.forEach((c, i) => {
        if (row().length >= width) rows.push([]);
        row().push(c);
        if (row().length === width && i < word.length - 1) rows.push([]);
      });
      return;
    }
    if (row().length && word.length && row().length + word.length > width)
      rows.push([]);
    row().push(...word);
  });
  return rows;
}

/** Widths of boxes laid side by side in `room` columns, as Ink's layout shrinks
 * them when they overflow: each by its share of the total, edges rounded. */
function shrink(bases: number[], room: number): number[] {
  const total = bases.reduce((a, b) => a + b, 0);
  const over = Math.max(0, total - room);
  let x = 0;
  const edges = [0, ...bases.map((b) => (x += b - (over * b) / total))].map(
    Math.round,
  );
  return bases.map((_, i) => edges[i + 1] - edges[i]);
}

const plain = (text: string, cls?: string): Cell[] =>
  [...text].map((ch): Cell => [ch, cls]);
const join = (a?: string, b?: string) =>
  [a, b].filter(Boolean).join(" ") || undefined;

/** **bold**, `code` in the permission color without ticks, *italic*. Each
 * mark turns its style on or off; a backslash keeps the next character as
 * drawn, e.g. \* for a star Claude Code showed. */
function inline(text: string, cls?: string): Cell[] {
  const out: Cell[] = [];
  const cs = Array.from(text);
  let b = false;
  let i = false;
  let l = false;
  const style = () =>
    join(cls, [b && "b", i && "i", l && "l"].filter(Boolean).join(" "));
  for (let k = 0; k < cs.length; k++) {
    const ch = cs[k];
    if (ch === "\\" && k + 1 < cs.length) out.push([cs[++k], style()]);
    else if (ch === "`" && !l && cs[k + 1] === "`") {
      // A span opened by a run of ticks closes at the next run as long and
      // drops one space at each end: `` `x` `` draws `x` (target).
      let n = 1;
      while (cs[k + n] === "`") n++;
      const tail = cs.slice(k + n).join("");
      const end = new RegExp(`(?<!\`)\`{${n}}(?!\`)`).exec(tail);
      if (!end) { k += n - 1; continue; }
      const body = tail.slice(0, end.index).replace(/^ (.*) $/s, "$1");
      l = true;
      for (const c of body) out.push([c, style()]);
      l = false;
      k += n + Array.from(tail.slice(0, end.index)).length + n - 1;
    } else if (ch === "`") l = !l;
    else if (l || ch !== "*") out.push([ch, style()]);
    else if (cs[k + 1] === "*") {
      b = !b;
      k++;
    } else i = !i;
  }
  return out;
}

/** Text as a Line that draws it as it stands: marks escaped. */
const escape = (text: string): Line => text.replace(/[\\*`]/g, "\\$&");

/** Plain text of a line, as a reader sees it: markup gone, indent gone. */
const text = (line: Line) =>
  line.replace(/\\(.)|\*|`/g, (_, kept) => kept ?? "").trimStart();

/** Lines as Claude Code draws them: headings bold then a blank row, list items
 * with a hanging indent, leading spaces kept as indent inside a list, and as
 * text outside one: a fence at the margin ends a list, so an indented line
 * after it keeps its spaces on its first row only (clarify). Fences are not drawn;
 * the lines inside stand as written: with no language, in lavender; "diff",
 * + lines green and - lines red, in the terminal's palette; any other, plain.
 * A "markdown" block is the one edit: Claude Code showed it as source, and the
 * site renders it as Claude Code renders markdown outside a block. A "card"
 * block is not drawn: Claude Code showed none (elicit). */
function draw(lines: Line[], width: number): Cell[][] {
  const out: Cell[][] = [];
  let afterHeading = false;
  let fenced = false;
  let lang = "";
  let markdown = false;
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!fenced && isRow(raw)) {
      const end = lines.findIndex((l, k) => k > i && !isRow(l));
      out.push(...table(lines.slice(i, end < 0 ? lines.length : end), width));
      i = (end < 0 ? lines.length : end) - 1;
      afterHeading = false;
      continue;
    }
    if (raw.startsWith("```") && (markdown || (!fenced && raw.slice(3).trim() === "markdown"))) {
      markdown = !markdown;
      continue;
    }
    if (raw.startsWith("```")) {
      fenced = !fenced;
      inList = false;
      lang = raw.slice(3).trim();
      continue;
    }
    if (fenced && lang === "card") continue;
    if (fenced) {
      const cls = lang === "diff" ? { "+": "c32", "-": "c31" }[raw[0]] : lang ? undefined : "l";
      // A line keeps its indent; a row it wraps onto drops one leading space,
      // the one carried from the full row above, and keeps any others.
      out.push(...wrapInk(plain(raw, cls), width).map((r, k) => (k && r[0]?.[0] === " " ? r.slice(1) : r)));
      continue;
    }
    if (!raw.trim()) {
      if (!afterHeading) out.push([]);
      afterHeading = false;
      continue;
    }
    afterHeading = false;
    const heading = !fenced && /^#{1,6} (.*)$/.exec(raw);
    if (heading) {
      out.push(...wrap(inline(heading[1], "b"), width), []);
      afterHeading = true;
      continue;
    }
    const [, lead, rest] = /^( *)(.*)$/.exec(raw)!;
    const item = !fenced && /^(-|\d+\.) (.*)$/.exec(rest);
    const mark = item ? item[1] + " " : "";
    if (item) inList = true;
    else if (!lead) inList = false;
    if (lead && !inList) {
      out.push(...wrap(inline(rest), width, width - lead.length).map((l, k) => (k ? l : [...plain(lead), ...l])));
      continue;
    }
    const hang = lead.length + mark.length;
    wrap(item ? keepNumbered(inline(item[2])) : inline(rest), width - hang).forEach((l, k) =>
      out.push([...plain(k ? " ".repeat(hang) : lead + mark), ...l]),
    );
  }
  while (out.length && !out[out.length - 1].length) out.pop();
  return out;
}

/** In a list item, Claude Code draws the space before a number that ends a
 * sentence ("a 202.", "Node 22.") as a no-break space, so no row of the item
 * starts with what reads as a numbered item's mark. Recorded in three list
 * items; three such numbers in paragraphs kept a plain space. It reads the
 * markdown, so a number in code ("`5 * 1000`.") keeps a plain space, and a
 * decimal ("for 1.5 s") is no mark (target). */
function keepNumbered(cs: Cell[]): Cell[] {
  const s = cs.map(([ch]) => ch).join("");
  const code = (c?: Cell) => /\bl\b/.test(c?.[1] ?? "");
  return cs.map((c, k) => (c[0] === " " && !code(cs[k + 1]) && /^\d+[.)](?!\d)/.test(s.slice(k + 1)) ? ["\u00a0", c[1]] : c));
}

// ---- Tables -------------------------------------------------------------------
// A markdown table as Claude Code draws it, inferred from every table in the
// recordings at 45, 80 and 120 columns. Columns take their widest cell when
// all fit in `width` - 2 - 3 per column - 1; otherwise each keeps its longest
// word and shares what is left by how much more its widest cell wants, floored.
// When even the longest words do not fit, each column takes its longest word's
// share of the room, floored, at least 3, and words break at the edge (shift
// and deepen, at 45).
// Cells wrap as Ink does; the header is centered, body cells left, and each
// cell sits floor(spare / 2) rows down. When a cell would wrap past 4 rows,
// each row becomes "header: value" lines between rules; the 4-row limit is
// the one guess here: it is the only rule seen that tells the recorded tables
// at 45 columns from the lists.

/** Whether a line is a row of a markdown table. */
const isRow = (l: Line) => /^\s*\|/.test(l);

/** A row's cells: split on bars a backslash does not keep. */
const rowCells = (l: Line) =>
  l.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());

function table(rows: Line[], width: number): Cell[][] {
  const [head, rule, ...body] = rows.map(rowCells);
  if (!rule?.every((c) => /^-+$/.test(c)))
    throw new Error(`A table's alignment row must be plain dashes: ${rows[1]}`);
  const n = head.length;
  const grid = [head, ...body].map((r) => head.map((_, c) => inline(r[c] ?? "")));
  const len = (cs: Cell[]) => cs.length;
  const words = (cs: Cell[]) => cs.map(([ch]) => ch).join("").split(" ").map((w) => w.length);
  const widest = head.map((_, c) => Math.max(...grid.map((r) => len(r[c]))));
  const longest = head.map((_, c) => Math.max(...grid.map((r) => Math.max(...words(r[c])))));
  const room = width - 2 - 3 * n - 1;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const extra = room - sum(longest);
  const want = sum(widest) - sum(longest);
  const cols =
    sum(widest) <= room
      ? widest
      : extra >= 0
        ? longest.map((m, c) => m + Math.floor(((widest[c] - m) * extra) / want))
        : longest.map((m) => Math.max(3, Math.floor((m * room) / sum(longest))));
  const wrapped = grid.map((r) => r.map((cs, c) => (cs.length ? wrapInk(cs, cols[c]) : [[]])));
  if (wrapped.some((r) => r.some((cell) => cell.length > 4)))
    return listed(head, grid.slice(1), width);
  const line = (l: string, m: string, r: string) =>
    plain(l + cols.map((w) => "─".repeat(w + 2)).join(m) + r);
  const drawRow = (cells: Cell[][][], center: boolean): Cell[][] => {
    const h = Math.max(...cells.map((x) => x.length));
    return Array.from({ length: h }, (_, y) => [
      ...plain("│"),
      ...cells.flatMap((cell, c) => {
        const at = y - Math.floor((h - cell.length) / 2);
        const text = cell[at] ?? [];
        const left = center ? Math.floor((cols[c] - text.length) / 2) : 0;
        return [
          ...plain(" ".repeat(1 + left)),
          ...text,
          ...plain(" ".repeat(cols[c] - text.length - left + 1)),
          ...plain("│"),
        ];
      }),
    ]);
  };
  return [
    line("┌", "┬", "┐"),
    ...drawRow(wrapped[0], true),
    ...wrapped.slice(1).flatMap((r) => [line("├", "┼", "┤"), ...drawRow(r, false)]),
    line("└", "┴", "┘"),
  ];
}

/** A listed value's rows joined by a space. Doubled spaces then close up,
 * but in code a row's end leaves two: "`lsof +D`" drew "lsof  +D" (intent),
 * "`cannot open plughw:S2 (No such device)`" drew "open  plughw:S2 (No  such"
 * (judge). A row that ends inside a word joins the next with nothing. */
function rejoined(rows: Cell[][]): Cell[] {
  const code = (c?: Cell) => /\bl\b/.test(c?.[1] ?? "");
  const cs = rows.flat();
  let at = 0;
  const joined = rows.flatMap((r, k) => {
    const split = k > 0 && cs[at - 1]?.[0] !== " " && cs[at]?.[0] !== " ";
    at += r.length;
    return k && !split ? [[" ", rows[k - 1].at(-1)?.[1]] as Cell, ...r] : r;
  });
  return joined.filter((c, k) => !(c[0] === " " && joined[k - 1]?.[0] === " " && !(code(c) && code(joined[k - 1]))));
}

/** A table too wide to draw, as Claude Code 2.1.316 lays it out for the
 * terminal's `cols` (the reply's width plus its gutter): each row as
 * "header: value" lines, the header bold, between rules of min(cols - 1, 40).
 * The value wraps, long words whole, at cols - 3 - the header's width (at
 * least 10; cols - 1 with no header); its first row goes behind the header,
 * and the rest, its rows rejoined, wraps again at cols - 3. Each line then
 * wraps as Ink draws text at the reply's width: a space past the edge takes
 * a row of its own (anchor, at 45). A carried space starts a row of the rest
 * (compose). One carried onto the value's second row is dropped, unless it
 * sits in code (anchor's `CREATE TABLE`, at 45). */
function listed(head: string[], body: Cell[][][], width: number): Cell[][] {
  const cols = width + 2;
  const rule = plain("─".repeat(Math.min(cols - 1, 40)));
  return body.flatMap((r, k) => [
    ...(k ? [rule] : []),
    ...head.flatMap((h, c) => {
      // A column with no header shows its value alone, and nothing when the
      // value is empty too (judge).
      if (!h.trim() && !r[c].length) return [];
      const key = h.trim() ? [...inline(h, "b"), ...plain(":", "b"), ...plain(" ")] : [];
      const rows = wrapInk(r[c], Math.max(key.length ? cols - (key.length - 2) - 3 : cols - 1, 10), false);
      const rest = rejoined(rows.slice(1));
      while (rest[0]?.[0] === " " && !/\bl\b/.test(rest[0][1] ?? "")) rest.shift();
      const lines = [[...key, ...rows[0]], ...(rest.length ? wrapInk(rest, cols - 3, false) : [])];
      return lines.filter((l, n) => !n || l.some(([ch]) => ch !== " ")).flatMap((l) => wrapInk(l, width));
    }),
  ]);
}

// Consecutive cells of one class become one segment.
const segs = (cs: Cell[]): Seg[] =>
  cs.reduce<Seg[]>((acc, [ch, c]) => {
    const prev = acc[acc.length - 1];
    if (prev && prev[1] === c) prev[0] += ch;
    else acc.push([ch, c]);
    return acc;
  }, []);

// ---- Rows ---------------------------------------------------------------------
const GUTTER: Seg[] = [["  "]];
const BULLET: Seg[] = [["⏺", "w"], [" "]];
const DIM_BULLET: Seg[] = [["⏺", "g"], [" "]];
const BLANK: Row = { segs: [] };

/** Claude's reply: the white bullet on its first row, the gutter on the rest. */
function reply(lines: Line[], cols: number): Row[] {
  return draw(lines, cols - 2).map((l, i): Row => ({
    segs: [...(i ? GUTTER : BULLET), ...segs(l)],
  }));
}

// A sent prompt: grey ❯, white text. A slash command's prompt wraps back to the left edge; any other prompt keeps
// its rows under the text, two columns in. Both as recorded, and neither fills
// the last column.
const user = (text: string, cols: number): Row[] =>
  (text.startsWith("/")
    ? wrap([...plain("❯ ", "g"), ...plain(text, "w")], cols - 1)
    : wrap(plain(text, "w"), cols - 3).map((l, k) => [
        ...plain(k ? "  " : "❯ ", k ? undefined : "g"),
        ...l,
      ])
  ).map((l): Row => ({ segs: segs(l), cls: "user" }));

/** The collapsed tool summary, two columns in: grey, counts bold, +lines
 * green, -lines red. A closing "[ view ]" takes a row of its own, bold grey,
 * at any width (interrogate). The space before it stays with the summary, so
 * a summary that fills its last row pushes that space onto a row of its own
 * (router at 45). */
const tools = (summary: string, cols: number): Row[] => {
  const at = summary.indexOf(" [ view ");
  if (at >= 0 && !summary.endsWith(" [ view ]")) return [...counts(summary.slice(0, at), cols), ...files(summary.slice(at), cols)];
  const view = summary.endsWith(" [ view ]");
  const rows = counts(view ? summary.slice(0, -" [ view ]".length) : summary, cols);
  const full = rows.length > 0 && rows[rows.length - 1].segs.map((s) => s[0]).join("").length >= cols;
  return [...rows, ...(view && full ? [BLANK] : []),
    ...(view ? [{ segs: [["  "], ["[ view ]", "g b"]] } as Row] : [])];
};
/** Links to the files a turn wrote, "[ view <file> ]", bold grey, on one row
 * under the summary. Claude Code draws the links that do not fit as a strip
 * down the right edge over the rows below (compose); that strip is a layout
 * glitch and is left out, as are links the recording cut. */
const files = (links: string, cols: number): Row[] => {
  const segs: Seg[] = [["  "]];
  let used = 2;
  for (const link of links.match(/\[ view [^\]]+ \]/g) ?? []) {
    const gap = used > 2 ? 1 : 0;
    if (used + gap + link.length > cols) break;
    if (gap) segs.push([" "]);
    segs.push([link, "g b"]);
    used += gap + link.length;
  }
  return used > 2 ? [{ segs }] : [];
};
const counts = (summary: string, cols: number): Row[] =>
  wrap(
    summary
      .split(/(\+\d+|-\d+|\d+)/)
      .filter(Boolean)
      .flatMap((p) =>
        plain(
          p,
          /^\+\d/.test(p)
            ? "add"
            : /^-\d/.test(p)
              ? "del"
              : /^\d/.test(p)
                ? "g b"
                : "g",
        ),
      ),
    cols - 2,
  ).map((l): Row => ({ segs: [["  "], ...segs(l)] }));

/** The activity line while Claude works: a grey bullet, the label wrapped
 * under it, +lines green and -lines red; then the newest tool's line, grey,
 * each of its lines wrapped five columns in, cut at 300 characters with "…"
 * (as recorded: a 296-character command whole, an 844-character one cut). */
function activityRows(
  line: Line,
  tool: string | undefined,
  cols: number,
): Row[] {
  const cells = inline(line);
  for (const m of cells
    .map(([x]) => x)
    .join("")
    .matchAll(/(?<!\S)([+-])\d+(?=[\s,]|$)/g))
    for (let k = m.index; k < m.index + m[0].length; k++)
      cells[k] = [cells[k][0], m[1] === "+" ? "add" : "del"];
  const label = wrap(cells, cols - 2).map((l, i): Row => ({
    segs: [...(i ? GUTTER : DIM_BULLET), ...segs(l)],
  }));
  if (!tool) return [...label, BLANK];
  const CUT = 300;
  const shown = tool.length > CUT ? tool.slice(0, CUT - 1) + "…" : tool;
  const lines = shown.split("\n").flatMap((l) => wrap(plain(l, "g"), cols - 5));
  return [
    ...label,
    ...lines.map((l, i): Row => ({
      segs: [[i ? "     " : "  ⎿  ", "g"], ...segs(l)],
    })),
    BLANK,
  ];
}

const SPIN = ["·", "✢", "✳", "✶", "✻", "✽"];
/** "4s", "2m 22s", as Claude Code counts the time a turn has run. */
const elapsed = (s: number) => {
  const n = Math.floor(s) + 1;
  return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${n % 60}s`;
};
/** The spinner `since` seconds into the turn, as recorded: glyph and verb
 * orange, three letters of the verb lit in turn; then, once Claude Code showed
 * one, the counter at `counted`, the recorded seconds the turn had run (it
 * jumps where the demo cut idle time), and the words it showed after it,
 * grey, "thinking …" lighter. */
function spinner(spin: Chrome["spin"], since: number, counted: number): Row {
  const verb = spin?.verb ?? "";
  const lit = Math.floor(since * 12) % (verb.length + 8) - 3;
  const [a, b] = [Math.max(0, lit), Math.max(0, lit + 3)];
  const tail = spin?.tail ? spin.tail.split(" · ") : [];
  return {
    segs: [
      [`${SPIN[Math.floor(since * 10) % SPIN.length]} ${verb.slice(0, a)}`, "o"],
      [verb.slice(a, b), "o2"],
      [`${verb.slice(b)}… `, "o"],
      ...(spin?.tail === undefined
        ? []
        : ([
            ["(" + [elapsed(counted), ...tail.filter((x) => !x.startsWith("thinking"))].join(" · "), "g"],
            ...tail.filter((x) => x.startsWith("thinking")).flatMap((x): Seg[] => [[" · ", "g"], [x, "g2"]]),
            [")", "g"],
          ] as Seg[])),
    ],
  };
}

// The logo is block glyphs; browsers leave gaps between lines of them, so the
// player draws its three rows as one picture of quadrants (player.ts), black
// where the recording was.
const LOGO = [
  [" ▐▛███▛█ ", "  kkkkkk "],
  ["▝▜██████▀", "  kkkkk  "],
  [" ▝▝   ▝▝ ", "         "],
];
/** The header: the logo, drawn as tall as one row, then "Claude Code" and its
 * version. The model row, the folder row, the blank row Claude Code drew
 * above them and the two below are left out, as the user asked (scenes.ts). */
const header = (): Row[] => [
  { segs: [[LOGO.map((r) => r.join("|")).join("/"), "logo"], ["  "], ["Claude Code", "b"], [" "], ["v2.1.316", "g"]], cls: "banner" },
];

// ---- One clock ----------------------------------------------------------------
// Seconds. The demo plays the recorder's keys and Claude's work in order at its
// own pace, cut as a screencast editor cuts idle time: the screen stands still
// for IDLE seconds at most, unless it shows words to read. Typed text, a
// dialog and a reply stay up as long as reading their words takes (readFor);
// a pause, an activity line, a skill's launch, a key move on sooner
// (tools/check-timing.mts holds every demo to this). A turn's activity lines
// hold no words to read, so all of them take K.work at most.

/** The longest the screen stands still with nothing new to read. */
export const IDLE = 1;
/** Reading pace: words at 250 a minute, at least IDLE and at most 4 s; a
 * longer reply stays in the transcript, to scroll back to. */
export const READ = { wpm: 250, floor: IDLE, ceil: 4 };
/** The words in a text: runs between spaces that hold a letter or a digit. */
export const words = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
/** How long reading these texts takes. */
const readFor = (...texts: string[]) =>
  Math.min(READ.ceil, Math.max(READ.floor, (words(texts.join(" ")) * 60) / READ.wpm));

const K = {
  start: 0.4,
  enter: 0.4,
  // The most a typed prompt holds, read, before the key after it.
  typed: 2.5,
  // Claude's pause before its first tool or dialog, or before a reply with none.
  lead: 0.8,
  think: 0.9,
  // Each activity line; when a turn's lines would run past work from sending,
  // they share it.
  act: 0.8,
  work: 10,
  // A reply's rows coming in.
  reveal: 0.9,
  // tend's toast: when it slides in after the reply starts, the slide, its stay.
  toastAt: 1.6,
  slide: 0.25,
  toastFor: 3.5,
  // A dialog: each arrow on options without previews, and the least the
  // answer stays picked before its Enter.
  nav: 0.3,
  hold: 0.9,
  // How long a keycap stays.
  keyFor: 1.6,
};
const ramp = (s: number, a: number, b: number) =>
  Math.min(1, Math.max(0, (s - a) / (b - a)));

type Key = Turn["keys"][number];

/** When a turn's keys land, it sends, shows each activity line, launches each
 * skill, opens each dialog, and its reply starts to arrive. */
type Phase = {
  start: number;
  sent: number;
  /** What the prompt holds from each moment until it is sent. */
  typing: [number, string][];
  /** When the slash menu shows, and until when. */
  menu?: [number, number];
  acts: number[];
  /** When each Skill call of the turn was made. */
  launches: number[];
  dialogs: { open: number; script: Script }[];
  reply: number;
  /** When each reply after the first starts to arrive: a subagent finished
   * (Turn.more). Each waits for the one before it to come in and be read. */
  more: number[];
  /** Each key the recorder sent, when it lands: name or text, as logged. */
  caps: [number, Key[1], string][];
};

/** When each turn of a scene plays its keys, sends, finishes replying. */
const timed = new WeakMap<Scene, { timing: Phase[]; length: number }>();
export function phases(scene: Scene): { timing: Phase[]; length: number } {
  if (!timed.has(scene)) timed.set(scene, time(scene));
  return timed.get(scene)!;
}
function time(scene: Scene): { timing: Phase[]; length: number } {
  let t = K.start;
  const timing = scene.turns.map((turn): Phase => {
    const { keys, activity = [], dialogs = [], launches = [], user } = turn;
    const start = t;
    // The keys before the prompt was sent type it; the last is the Enter that sent it.
    const pre = keys.filter(([at]) => at < 0);
    const enter = pre[pre.length - 1];
    if (!enter || enter[1] !== "key" || enter[2] !== "Enter")
      throw new Error(`"${user}": the key log ends its typing with no Enter`);
    const caps: Phase["caps"] = [];
    const typing: Phase["typing"] = [];
    let menu: Phase["menu"];
    let text = "";
    // The text typed since the last key: keys typed one after another land
    // at once, so the prompt shows whole and holds once while it is read.
    let run = "";
    pre.forEach(([, kind, value], k) => {
      caps.push([t, kind, value]);
      if (kind === "type") typing.push([t, (text += value)]);
      run = kind === "type" ? run + value : "";
      if (k === pre.length - 1) return;
      const [, kindNext, valueNext] = pre[k + 1];
      const next =
        t +
        (kind === "type"
          ? kindNext === "type"
            ? 0
            : Math.min(K.typed, readFor(run))
          : valueNext === "Enter"
            ? K.enter
            : K.nav);
      if (turn.menu?.after === k) menu = [t, next];
      t = next;
    });
    const sent = t;
    // Each dialog takes the keys pressed while it was open, give or take a
    // second: the key log and the session file keep separate clocks (the
    // Enter that answered interrogate's second dialog was logged 0.2 s after
    // the answer). Any other key after sending lands where its moment falls.
    const post = keys.filter(([at]) => at >= 0);
    const within = (d: Dialog) => post.filter(([at]) => at >= d.at[0] - 1 && at <= d.at[1] + 1);
    const stray = post.filter((k) => !dialogs.some((d) => within(d).includes(k)));
    // What the turn shows, in the order it happened: each activity line, each
    // dialog after the lines shown before it opened, and each skill launch
    // after whatever was on screen when its Skill call was made. A launch
    // takes no time of its own; the line on screen holds as its own.
    type Stop = { at: number; run: () => void };
    const stops: Stop[] = [];
    let u = sent + K.lead;
    const opened: Phase["dialogs"] = [];
    const acts: number[] = [];
    const launched: Phase["launches"] = [];
    // The activity line on screen, as its label and tool line: a dialog leaves
    // its question there. A line that repeats it changes nothing, so takes no time.
    let onScreen = "";
    const rowsOf = (a: Activity) => `${a.line}\n${a.tool ?? ""}`;
    const changes = activity.filter(
      (a, k) => !k || dialogs.some((d) => d.after === k) || rowsOf(a) !== rowsOf(activity[k - 1]),
    ).length;
    const act = Math.min(K.act, (K.work - K.lead) / changes);
    const ask = (d: Dialog) => {
      onScreen = `${escape(d.questions[0].question)}\n${d.tool ?? ""}`;
      const sc = script(d, within(d));
      opened.push({ open: u, script: sc });
      caps.push(...sc.caps.map(([at, kind, value]): Phase["caps"][number] => [u + at, kind, value]));
      // A dialog left open ends the turn: nothing follows it to wait for.
      u += sc.length + (d.left ? 0 : K.act);
    };
    activity.forEach((a, k) => {
      dialogs.forEach((d) => d.after === k && stops.push({ at: d.at[0], run: () => ask(d) }));
      stops.push({
        at: a.at,
        run: () => {
          acts.push(u);
          const rows = rowsOf(a);
          if (rows !== onScreen) u += act;
          onScreen = rows;
        },
      });
    });
    dialogs.forEach((d) => d.after >= activity.length && stops.push({ at: d.at[0], run: () => ask(d) }));
    launches.forEach(({ at, skill }) => {
      const inside = dialogs.find((d) => d.at[0] < at && at < d.at[1]);
      if (inside) throw new Error(`"${user}": ${skill} launched while a dialog was open`);
      const k = stops.findIndex((s) => s.at > at);
      stops.splice(k < 0 ? stops.length : k, 0, { at, run: () => launched.push(u) });
    });
    stops.forEach((s) => s.run());
    const reply = stops.length ? u : sent + K.think;
    const replies = [turn.reply, ...(turn.more ?? []).map((m) => m.reply)];
    const arrive = replies.reduce<number[]>((at, r, k) => [...at, k ? at[k - 1] + K.reveal + readFor(...replies[k - 1]) : reply], []);
    const p: Phase = { start, sent, typing, menu, acts, launches: launched, dialogs: opened, reply, more: arrive.slice(1), caps };
    for (const [at, kind, value] of stray) caps.push([demoAt(turn, p, at), kind, value]);
    caps.sort((a, b) => a[0] - b[0]);
    // A turn that ends on a dialog left open has no reply to show.
    t = dialogs.at(-1)?.left ? reply : arrive.at(-1)! + K.reveal + readFor(...replies.at(-1)!);
    return p;
  });
  return { timing, length: t };
}

/** A moment the terminal waits on the user: a dialog's question, its
 * options showing, halfway to the first key on it (the keycaps before it
 * gone, the pick not yet moved), or each reply that ends a turn standing
 * whole: the turn's own (`n` 0), then each that came after it (Turn.more). A
 * turn that ends on a dialog left open waits there, with no reply. */
export type Wait = { at: number; turn: number } & ({ on: "reply"; n: number } | { on: "dialog"; d: number; q: number });

/** Every moment the terminal waits on the user, in order. */
export function waits(scene: Scene, timing = phases(scene).timing): Wait[] {
  return timing.flatMap((p, turn): Wait[] => [
    ...p.dialogs.flatMap(({ open, script: { moments, length } }, d) =>
      // A dialog left open shows its first question only: no answer moves it on.
      scene.turns[turn].dialogs![d].questions.slice(0, scene.turns[turn].dialogs![d].left ? 1 : undefined).map((_, q): Wait => {
        const k = moments.findIndex((m) => m.q === q);
        return { at: open + (moments[k].at + (moments[k + 1]?.at ?? length)) / 2, turn, on: "dialog", d, q };
      }),
    ),
    ...(scene.turns[turn].dialogs?.at(-1)?.left
      ? []
      : [p.reply, ...p.more].map((at, n): Wait => ({ at: at + K.reveal, turn, on: "reply", n }))),
  ]);
}

/** What a working turn shows `at` seconds into the scene: the newest activity
 * line, or a dialog's question once it closed. */
function working(turn: Turn, p: Phase, at: number, cols: number): Row[] {
  const k = p.acts.findLastIndex((x) => x <= at);
  const j = p.dialogs.findLastIndex((d) => d.open <= at);
  if (j >= 0 && (k < 0 || p.acts[k] < p.dialogs[j].open))
    return asked(turn.dialogs![j], cols);
  const a = turn.activity?.[k];
  return a ? activityRows(a.line, a.tool, cols) : [];
}

/** The transcript `s` seconds into a scene, what the prompt holds, and the
 * slash menu if it shows. */
function transcriptAt(scene: Scene, s: number, cols: number) {
  const { timing } = phases(scene);
  const transcript: Row[] = header();
  let typing = "";
  let menu: Row[] | undefined;
  let asking: { dialog: Dialog; moment: Moment } | undefined;
  let chrome = scene.chrome;
  // The newest reply's first row, once it has one.
  let top: number | undefined;
  scene.turns.forEach((turn, i) => {
    const p = timing[i];
    if (s < p.start) return;
    chrome = chromeAt(turn, p, s) ?? chrome;
    if (s < p.sent) {
      typing = p.typing.findLast(([x]) => x <= s)?.[1] ?? "";
      if (p.menu && s >= p.menu[0] && s < p.menu[1])
        menu = turn.menu!.rows.map((r): Row => ({ segs: segs(r.flatMap(([x, c]) => plain(x, c)).slice(0, cols)) }));
      return;
    }
    top = undefined;
    transcript.push(...user(turn.user, cols), BLANK);
    const since = s - p.sent;
    const counted = Math.min(recordedAt(turn, p, s), turn.replyAt);
    // While a dialog is open, focus mode shows its first question as the
    // activity line; until the reply, the newest activity line.
    const open = p.dialogs.findIndex((d, k) => s >= d.open && (turn.dialogs![k].left || s < d.open + d.script.length));
    if (open >= 0) {
      const dialog = turn.dialogs![open];
      transcript.push(...asked(dialog, cols));
      asking = { dialog, moment: momentAt(p.dialogs[open].script, s - p.dialogs[open].open) };
      return;
    }
    if ((p.acts.length || p.dialogs.length) && s < p.reply) {
      transcript.push(
        ...working(turn, p, s, cols),
        spinner(chrome.spin, since, counted),
        BLANK,
      );
      return;
    }
    if (turn.tools && since > K.think * 0.4)
      transcript.push(...tools(turn.tools, cols), ...(turn.interrupted ? [INTERRUPTED] : []), BLANK);
    const rows = reply(turn.reply, cols);
    // Row by row, the first landing as the reply arrives and the last as the
    // reveal ends.
    const n =
      s < p.reply ? 0 : Math.min(rows.length, Math.max(1, Math.floor(rows.length * ramp(s, p.reply, p.reply + K.reveal))));
    if (n) top = transcript.length;
    transcript.push(...rows.slice(0, n), ...(n ? [BLANK] : []));
    if (n < rows.length) transcript.push(spinner(chrome.spin, since, counted), BLANK);
    // What came after it with no prompt: each reply in turn, row by row as
    // the first came, once the one before it has been read.
    else
      (turn.more ?? []).forEach((m, k) => {
        const at = p.more[k];
        if (s < at) return;
        const rows = reply(m.reply, cols);
        transcript.push(...(m.tools ? [...tools(m.tools, cols), BLANK] : []));
        top = transcript.length;
        transcript.push(...rows.slice(0, Math.max(1, Math.floor(rows.length * ramp(s, at, at + K.reveal)))), BLANK);
      });
  });
  if (transcript[transcript.length - 1] === BLANK) transcript.pop();
  return { transcript, typing, menu, asking, chrome, top };
}

/** Claude Code's row under the tool summary once the user pressed Esc. */
const INTERRUPTED: Row = { segs: [["  ⎿  Interrupted · What should Claude do instead?", "g"]] };

/** The recorded moment a turn shows `at` seconds into the scene: the demo's
 * times for its first key, sending, each activity line, each dialog and the
 * reply, matched to when each happened, with straight lines between; once the
 * reply is in, every moment of the turn. */
function recordedAt(turn: Turn, p: Phase, at: number): number {
  if (at >= p.reply) return Infinity;
  const t = turn;
  const pairs = ([
    [p.start, t.keys[0][0]],
    [p.sent, 0],
    ...p.acts.map((x, k): [number, number] => [x, t.activity![k].at]),
    ...p.launches.map((at, n): [number, number] => [at, t.launches![n].at]),
    ...p.dialogs.flatMap((d, j): [number, number][] => [
      [d.open, t.dialogs![j].at[0]],
      [d.open + d.script.length, t.dialogs![j].at[1]],
    ]),
    [p.reply, t.replyAt],
  ] as [number, number][]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const k = Math.max(0, pairs.findLastIndex(([x]) => x <= at));
  const [x0, r0] = pairs[k];
  const [x1, r1] = pairs[k + 1] ?? pairs[k];
  return x1 > x0 ? r0 + ((Math.min(at, x1) - x0) / (x1 - x0)) * (r1 - r0) : r0;
}

/** What Claude Code drew around the prompt box for a turn at that moment; none
 * before the turn's first capture. */
function chromeAt(turn: Turn, p: Phase, at: number): Chrome | undefined {
  const r = recordedAt(turn, p, at);
  return turn.chrome.findLast(([x]) => x <= r)?.[1];
}

/** The demo's time for a turn's recorded moment: recordedAt run backwards. */
function demoAt(turn: Turn, p: Phase, r: number): number {
  let [lo, hi] = [p.start, p.reply];
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (recordedAt(turn, p, mid) < r) lo = mid;
    else hi = mid;
  }
  return hi;
}

export type Frame = {
  transcript: Row[];
  bottom: Row[];
  /** A toast over the top right corner, and how far it has slid in (0 to 1). */
  toast?: { rows: Row[]; slide: number };
  /** Where the terminal's cursor rests: a row of `bottom` and a column; none
   * while a dialog without a text field is open. */
  cursor?: { row: number; col: number };
  /** The keys the recorder pressed in the last moments, oldest first, each
   * with its opacity: it fades over the second half of its stay. Typed text
   * gets none; the prompt box or the dialog's field shows it. */
  keys: { label: string; fade: number }[];
  /** The question on screen, if a dialog is open: its index, how many options
   * it has, and which one the dialog's cursor is on. */
  asking?: { q: number; options: number; cursor: number };
  /** The transcript row to stand at the top while the terminal waits on
   * the user: the newest reply's first row, once it is in. */
  top?: number;
  /** The names of tend's chips on screen, e.g. "questions"; a pane opens
   * only on one of them. */
  chips: string[];
};

/** Typed text as the prompt box draws it: a slash command's name lavender. */
const prompted = (text: string): Cell[] =>
  text.split(/(\s+)/).flatMap((w) => plain(w, /^\/[a-z][\w:-]*$/.test(w) ? "l" : undefined));

/** Everything on screen `s` seconds into a scene, in a terminal `rows` high;
 * `pick` puts the dialog's cursor on an option the reader chose; `pane` opens
 * tend's pane for the chip of that name, if it shows. */
export function frame(scene: Scene, s: number, cols: number, pick?: number, rows = ROWS, pane?: string): Frame {
  const { timing } = phases(scene);
  const { transcript, typing, menu, asking, chrome, top } = transcriptAt(scene, s, cols);
  // The prompt box's rules and the status line reach the frame's right edge
  // (Demo.astro's .wide); the text in it wraps at `cols`.
  const rule: Row = { segs: [["─".repeat(cols), "r"]], cls: "wide rule" };
  const prompt = wrap(prompted(typing), cols - 2);
  // tend's toast belongs to the newest reply in.
  const done = timing.findLastIndex((p) => s >= p.reply);
  const turn = done >= 0 ? scene.turns[done] : undefined;
  const since = done >= 0 ? s - timing[done].reply - K.toastAt : -1;
  const toast =
    turn?.toast && since >= 0 && since < K.toastFor
      ? { rows: toastRows(turn.toast, cols), slide: ramp(since, 0, K.slide) }
      : undefined;
  const keys = timing.flatMap((p) =>
    p.caps.flatMap(([at, kind, value]) => {
      const age = s - at;
      return kind === "key" && age >= 0 && age < K.keyFor
        ? [{ label: CAPS[value] ?? value, fade: Math.min(1, 2 - (2 * age) / K.keyFor) }]
        : [];
    }),
  );
  if (asking) {
    const moment = pick === undefined ? asking.moment : { ...asking.moment, cursor: pick, shown: pick };
    const q = asking.dialog.questions[moment.q];
    const shown = dialogShown(asking.dialog, moment, cols, rows);
    const at = shown.findIndex((r) => r.input !== undefined);
    return {
      transcript, bottom: shown, toast, keys, chips: [],
      cursor: at < 0 ? undefined : { row: at, col: shown[at].input! },
      asking: q ? { q: moment.q, options: q.options.length, cursor: moment.cursor } : undefined,
    };
  }
  const input: Row[] = typing
    ? prompt.map((l, k): Row => ({ segs: [k ? ["  "] : ["❯ "], ...segs(l)] }))
    : [{ segs: [["❯ "]] }];
  // tend's band, as recorded, and the pane its chips open: the newest reply's.
  const chips = (chrome.band ?? []).map((label): Item => {
    const name = label.replace(/ \d+$/, "");
    if (!turn?.panes?.[name]) throw new Error(`tend's chip "${label}" shows, and no turn's reply in has its pane`);
    return { id: `chip:${name}`, label, kind: "chip", ...(name === pane ? { open: true as const } : {}) };
  });
  const open = chips.some((c) => c.open) ? turn!.panes![pane!] : undefined;
  const below: Row[] = [
    ...(chips.length ? bandRows(chips, cols) : []),
    // The row Claude Code keeps above the prompt box for a notice, blank: its
    // notices are left out, as the user asked (scenes.ts). The slash menu
    // takes it, as recorded.
    ...(menu ?? [BLANK]),
    rule,
    ...input,
    rule,
    // The mode row under it, "⏵⏵ bypass permissions on …", is left out, as
    // the user asked (scenes.ts).
    statusRow(chrome, cols),
  ];
  // The pane takes the rows the terminal has left above the rest.
  const bottom = [...(open ? paneRows(open, cols, rows - height(below)) : []), ...below];
  // The cursor ends the typed text, or starts the empty prompt.
  const col = typing ? 2 + prompt[prompt.length - 1].length : 2;
  return {
    transcript, bottom, toast, keys, top,
    chips: chips.map((c) => c.id.replace(/^chip:/, "")),
    cursor: { row: bottom.indexOf(input[input.length - 1]), col },
  };
}

// ---- tend ---------------------------------------------------------------------
// tend's band and pane, laid out by tend's own layout() (band.ts)
// and styled as its BandView draws them.

/** One laid-out item in segments: a button's brackets subtle unless it is
 * open or clipped, a note dim, a title, a strong line or an open chip bold,
 * an open chip in the selection colour. The chips and close act on a click. */
function itemSegs({ item, text }: BandCell): Seg[] {
  const button = item.kind === "chip" || item.id === "close";
  const act = button ? item.id : undefined;
  const cls = join(
    item.open ? "l" : item.kind === "note" ? "g" : undefined,
    item.open || item.kind === "title" || item.strong ? "b" : undefined,
  );
  const at = text.indexOf(item.label);
  if (!button || item.open || at < 0) return [[text, cls, act]];
  return [
    [text.slice(0, at), "sub", act],
    [item.label, cls, act],
    [text.slice(at + item.label.length), "sub", act],
  ];
}

/** A band or pane's lines as rows, each item at its planned column. */
function laidOut(b: Band, width: number): Row[] {
  return layout(b, width).map((l) => {
    const out: Seg[] = [];
    let x = 0;
    for (const c of l.cells) {
      if (c.x > x) out.push([" ".repeat(c.x - x)]);
      out.push(...itemSegs(c));
      x = c.x + c.text.length;
    }
    return { segs: out };
  });
}

/** The band as recorded: Claude Code's grey "[-]" ending a column from the
 * right edge, then tend's chips. On the page the "[-]" row reaches the frame's
 * right edge, as the status line does (Demo.astro's .wide). */
const bandRows = (chips: Item[], cols: number): Row[] => [
  { segs: [[" ".repeat(Math.max(0, cols - 4)), "fill"], ["[-]", "g"], [" "]], cls: "wide" },
  ...laidOut({ chips, body: [] }, cols),
];

/** tend's pane, which Claude Code's main screen seats above the prompt. No
 * recording shows one open: the frame is drawn as the toast's box, titled
 * "tend" as tend opens it, around tend's Pane render (tend.tsx): at most
 * MEASURE wide, its text two columns in and a blank row above and below. In
 * fewer than `room` rows its title row stays and its last lines give way to
 * a grey "…". */
function paneRows(pane: Band, cols: number, room: number): Row[] {
  const inner = Math.min(cols - 2, MEASURE);
  const side = (r: Row): Row => {
    const used = r.segs.reduce((n, [x]) => n + [...x].length, 0);
    return { segs: [["│", "d"], ["  "], ...r.segs, [" ".repeat(Math.max(0, inner - 4 - used))], ["  "], ["│", "d"]] };
  };
  const title = " tend ";
  const lines = laidOut(pane, inner - 4);
  // The frame's own rows: its two edges and a blank row inside each.
  const fits = Math.max(1, room - 4);
  const shown = lines.length <= fits ? lines : [...lines.slice(0, Math.max(1, fits - 1)), { segs: [["…", "g"]] }];
  return [
    { segs: [["╭─", "d"], [title, "g"], ["─".repeat(Math.max(0, inner - 1 - title.length)) + "╮", "d"]] },
    side(BLANK),
    ...shown.map(side),
    side(BLANK),
    { segs: [["╰" + "─".repeat(inner) + "╯", "d"]] },
  ].map((r) => ({ ...r, cls: "pane" }));
}

/** A key's cap, as KeyCastr draws it. */
const CAPS: Record<string, string> = { Enter: "⏎", Down: "↓", Up: "↑", Left: "←", Right: "→", Escape: "Esc", Tab: "⇥", BSpace: "⌫" };

/** The status line as the user's status line drew it, cut to the two parts
 * the demo keeps: context use at the left, the output style, if any, at the right,
 * ending two columns from the edge, as recorded. On the page the gap between
 * them grows, so the output style ends at the frame's right edge (Demo.astro's
 * .wide), as the user asked. */
function statusRow({ context, style }: Chrome, cols: number): Row {
  const [pct, size] = context.split(" · ");
  const left: Seg[] = [
    ["  "],
    [`◔ Context ${pct}`, "c95"],
    ...(size ? ([[" · ", "c37"], [size, "c95"]] as Seg[]) : []),
  ];
  if (!style) return { segs: left, cls: "wide" };
  const right = `◎ ${style}`;
  const used = left.reduce((n, [x]) => n + [...x].length, 0);
  return { segs: [...left, [" ".repeat(Math.max(1, cols - 2 - used - right.length)), "fill"], [right, "c96"]], cls: "wide" };
}

/** A dialog's rows on a terminal `rows` high. Taller than the recorded
 * terminal, it shows its last rows, as recorded at 45. Taller than the
 * terminal on screen, less the rows the keycaps take above it, its preview
 * hides lines first, down to one, as the user asked; then rows above the
 * question go, then rows at the bottom. The question always shows. */
function dialogShown(d: Dialog, m: Moment, cols: number, rows: number): Row[] {
  const room = rows - KEYCAPS;
  const draw = (max: number) => fit(dialogRows(d, m, cols, max), ROWS);
  let max = PREVIEW;
  let drawn = draw(max);
  while (max > 1 && height(drawn) > room) drawn = draw(--max);
  return keep(drawn, room, Math.max(0, drawn.findIndex((r) => r.cls === "ask")));
}

/** Rows a dialog leaves above it for the keycaps (player.ts placeKeys()). */
export const KEYCAPS = 2;

/** A row's height in rows: one, or one and a half with a gap below. */
const rowH = (r: Row) => (r.cls?.includes("gap") ? 1.5 : 1);
const height = (rows: Row[]) => rows.reduce((n, r) => n + rowH(r), 0);

/** The rows that fit in `budget` rows, dropping rows above `from` first and
 * then rows at the end. */
function keep(rows: Row[], budget: number, from: number): Row[] {
  let start = 0;
  let used = height(rows);
  while (used > budget && start < from) used -= rowH(rows[start++]);
  let end = rows.length;
  while (used > budget && end > start) used -= rowH(rows[--end]);
  return rows.slice(start, end);
}

/** The last rows that fit in `budget` rows. */
function fit(rows: Row[], budget: number): Row[] {
  let used = 0;
  let k = rows.length;
  while (k > 0 && used + rowH(rows[k - 1]) <= budget) used += rowH(rows[--k]);
  return rows.slice(k);
}

/** A hunch toast as recorded at 80 columns: a dim box 43 wide, "hunch" in
 * grey, the message wrapped inside one space from each side. */
function toastRows(message: string, cols: number): Row[] {
  const w = Math.min(43, cols);
  const side = (cells: Cell[]): Row => ({
    segs: [
      ["│", "d"],
      [" "],
      ...segs(cells),
      [" ".repeat(w - 4 - cells.length)],
      [" "],
      ["│", "d"],
    ],
  });
  return [
    { segs: [["╭" + "─".repeat(w - 2) + "╮", "d"]] },
    side(plain("hunch", "g")),
    ...wrap(plain(message), w - 4).map(side),
    { segs: [["╰" + "─".repeat(w - 2) + "╯", "d"]] },
  ];
}

// ---- Dialogs ------------------------------------------------------------------
// An AskUserQuestion dialog as recorded: one tab per question, the question
// bold, options numbered with their descriptions under them, then the
// free-text row, and a review screen before Submit.

/** What the dialog shows from `at` seconds after it opens: question `q` (the
 * review screen once q is past the last), the row the cursor is on, the option
 * whose preview shows (the last one the cursor was on), ticked rows, and what
 * is typed so far. Rows count options, then "Type something" (multi-select's
 * "Next" after it) or, with previews, "Chat about this". */
type Moment = {
  at: number;
  q: number;
  cursor: number;
  shown: number;
  ticked: number[];
  typed: string;
  /** Notes typed so far, and whether their field has the cursor. */
  notes: string;
  noting: boolean;
};
type Script = { moments: Moment[]; length: number; caps: [number, Key[1], string][] };

/** Whether a question draws its options beside a preview box. */
const previewed = (q: Dialog["questions"][number]) =>
  q.options.some((o) => o.preview !== undefined);

/** The recorder's keys played back, one moment each: arrows move the cursor,
 * n opens the notes field, typed text lands whole, Enter picks the cursor's
 * option and moves to the next question, the review screen, or Submit. Each
 * pick and each text typed must be the one the session file records. A
 * question stays as long as reading it and its options takes; the review
 * screen, its questions and answers; a preview, its own words. */
function script(d: Dialog, keys: Key[]): Script {
  const qs = d.questions;
  const fail = (why: string): never => {
    throw new Error(`Dialog "${qs.map((q) => q.header).join(", ")}": ${why}`);
  };
  // The words a moment shows in rows the moment before did not, on the
  // page's pane.
  const rowsOf = (x?: Moment) => (x ? dialogShown(d, x, PANE.cols, PANE.rows).map((r) => r.segs.map(([c]) => c).join("")) : []);
  const fresh = (from: Moment | undefined, to: Moment) => {
    const before = rowsOf(from);
    return rowsOf(to).filter((r) => {
      const k = before.indexOf(r);
      if (k >= 0) before.splice(k, 1);
      return k < 0;
    });
  };
  const reading = (from: Moment | undefined, to: Moment) => readFor(...fresh(from, to));
  let m: Moment = { at: 0, q: 0, cursor: 0, shown: 0, ticked: [], typed: "", notes: "", noting: false };
  const moments: Moment[] = [m];
  const caps: Script["caps"] = [];
  let t = reading(undefined, m);
  // A dialog the take left open stands while it is read, and no key lands on it.
  if (d.left) {
    if (keys.length) fail(`a key on a dialog the take left open: ${keys.map(([, , v]) => v).join(" ")}`);
    return { moments, length: t, caps: [] };
  }
  // The pause after the last key, so the answer stays picked K.hold before Enter.
  let stood = t;
  let done = false;
  for (const [, kind, value] of keys) {
    if (done) fail(`a key after Submit: ${value}`);
    const q = qs[m.q];
    const n = q?.options.length ?? 2;
    if (value === "Enter" && kind === "key") t += Math.max(0, K.hold - stood);
    const next: Moment = { ...m, at: t };
    let after = K.nav;
    if (kind === "type") {
      if (m.noting) next.notes += value;
      else if (q && !previewed(q) && m.cursor === n) next.typed += value;
      else fail(`text typed outside a field: ${value}`);
      // As long as the words it shows take: a narrow notes field shows only
      // its last rows (chain, at 45).
      after = reading(m, next);
    } else if (value === "Down" || value === "Up") {
      if (m.noting) fail("an arrow while typing notes");
      const last = !q ? 1 : previewed(q) ? n : n + (q.multiSelect ? 2 : 1);
      next.cursor = Math.max(0, Math.min(last, m.cursor + (value === "Down" ? 1 : -1)));
      if (q && next.cursor < n) next.shown = next.cursor;
      after = q && previewed(q) && next.shown !== m.shown ? readFor(...fresh(m, next)) : K.nav;
    } else if (value === "n" && q && previewed(q)) {
      next.noting = true;
    } else if (value === "Enter") {
      if (!q) {
        if (m.cursor !== 0) fail("Enter on Cancel");
        done = true;
      } else {
        if (q.multiSelect) fail("a multi-select question has no key script yet");
        const pick = q.typed !== undefined ? n : q.picked[0];
        if (m.cursor !== pick) fail(`Enter on row ${m.cursor}; the session file records ${pick}`);
        if ((q.typed ?? "") !== m.typed || (q.notes ?? "") !== m.notes)
          fail(`typed "${m.typed || m.notes}"; the session file records "${q.typed ?? q.notes ?? ""}"`);
        Object.assign(next, { q: m.q + 1, cursor: 0, shown: 0, typed: "", notes: "", noting: false });
        // One question submits on Enter; more go through the review screen.
        done = qs.length === 1;
        after = reading(m, next);
      }
    } else fail(`a key the demo cannot play: ${value}`);
    caps.push([t, kind, value]);
    m = next;
    moments.push(m);
    if (done) break;
    t += after;
    stood = after;
  }
  if (!done) fail("the key log never submits it");
  // The dialog closes on the Enter that submits it.
  return { moments, length: t, caps };
}

const momentAt = (sc: Script, since: number) =>
  sc.moments.findLast((m) => m.at <= since) ?? sc.moments[0];

/** The activity line a dialog sets: its first question, then the last tool's line. */
const asked = (d: Dialog, cols: number) =>
  activityRows(escape(d.questions[0].question), d.tool, cols);

/** Text after a lead, wrapped to the width left; later rows take `rest`. */
const lead = (first: Seg[], rest: Seg[], cells: Cell[], width: number, firstWidth = width): Row[] =>
  wrap(cells, width, firstWidth).map((l, k): Row => ({
    segs: [...(k ? rest : first), ...segs(l)],
  }));

/** The dialog for one moment: tabs, then the question or the review screen. */
/** The lines a preview shows at most: Claude Code leaves 26 rows of the
 * terminal to the rest of the dialog. */
const PREVIEW = ROWS - 26;

/** A dialog's rows at moment `m`, its preview showing at most `max` lines. */
function dialogRows(d: Dialog, m: Moment, cols: number, max = PREVIEW): Row[] {
  const qs = d.questions;
  const review = m.q === qs.length;
  const rule: Row = { segs: [["─".repeat(cols), "g"]] };
  const tabs = tabRows(d, m, cols);
  // A long question gets a dim bar down its left edge. Its rows wrap as
  // Ink does, then lose their leading space: after a row that fills the width,
  // the next holds one less (as recorded on the review screen at 45).
  const ask = (text: string, before: string, mark: string, width: number) => {
    const cells = plain(text, mark ? undefined : "w b");
    const left = width - before.length - mark.length;
    const rows = (w: number) =>
      wrapInk(cells, w).map((r) => r.slice(r.findIndex(([ch]) => ch !== " ")));
    // The bar comes with a long question at any width: recorded on questions
    // of 82 characters and more, never on one of 77 or less, even where it
    // wraps (compose's moo-on take). Between, unknown: 80 splits it.
    const barred = text.length > 80;
    const bar: Seg[] = barred ? [[before], ["│", "d"], [" "]] : [[before]];
    return rows(barred ? left - 2 : left).map((l, k): Row => ({
      segs: [...bar, [k ? " ".repeat(mark.length) : mark], ...segs(l)],
      cls: "ask",
    }));
  };
  const answer = (q: (typeof qs)[number]) =>
    q.multiSelect
      ? [
          ...q.picked.map((i) => q.options[i].label),
          ...(q.typed ? [`"${q.typed}"`] : []),
        ].join(", ")
      : (q.typed ?? q.options[q.picked[0]].label);
  // The review screen, as recorded, keeps a row above its rule.
  if (review)
    return [
      BLANK,
      rule,
      ...tabs,
      BLANK,
      { segs: [["Review your answers", "w b"]] },
      BLANK,
      ...qs.flatMap((q) => [
        ...ask(q.question, " ", "● ", cols),
        // The answer's first row holds 5 short of the width, the rest 4
        // (recorded with a typed answer at 45, 80 and 120).
        ...lead(
          [["   "], ["→ ", "ok"]],
          [["   "]],
          plain(answer(q), "ok"),
          cols - 4,
          cols - 5,
        ),
      ]),
      BLANK,
      { segs: [["Ready to submit your answers?", "g"]] },
      BLANK,
      {
        segs: [
          ["❯ ", "l"],
          ["1. ", "g"],
          ["Submit answers", "l"],
        ],
      },
      { segs: [["  "], ["2. ", "g"], ["Cancel"]] },
    ];
  const q = qs[m.q];
  // With previews, as recorded, a row stays above the rule, as on review.
  if (previewed(q))
    return [
      BLANK,
      rule,
      ...tabs,
      BLANK,
      ...ask(q.question, "", "", cols),
      BLANK,
      ...previewRows(d, q, m, cols, max),
      BLANK,
      rule,
      // The cursor past the last option: both it and the last option marked.
      m.cursor === q.options.length
        ? { segs: [["❯", "l"], [" "], ["Chat about this", "l"]] }
        : { segs: [["  Chat about this"]] },
      BLANK,
      ...wrap(
        plain(
          [
            "Enter to select",
            "↑/↓ to navigate",
            "n to add notes",
            ...(qs.length > 1 ? ["Tab to switch questions"] : []),
            ...(m.noting ? ["ctrl+g to edit in Vim"] : []),
            "Esc to cancel",
          ].join(" · "),
          "g",
        ),
        cols,
      ).map((l): Row => ({ segs: segs(l) })),
    ];
  const n = q.options.length;
  const cur = (row: number): Seg => (m.cursor === row ? ["❯ ", "l"] : ["  "]);
  const box = (on: boolean): Seg[] =>
    q.multiSelect ? [on ? ["[✔] ", "ok"] : ["[ ] "]] : [];
  const indent = q.multiSelect ? 9 : 5;
  // Tab moves between questions only when there are several, as recorded.
  const nav = qs.length > 1 ? "Tab/Arrow keys to navigate" : "↑/↓ to navigate";
  const footer =
    m.cursor === n
      ? `Enter to select · ${nav} · ctrl+g to edit in Vim · Esc to cancel`
      : `Enter to select · ${nav} · Esc to cancel`;
  return [
    rule,
    ...tabs,
    BLANK,
    ...ask(q.question, "", "", cols),
    BLANK,
    // Half a row of space under each description, the user's choice for the
    // site: Claude Code draws none. fit() counts it against the row budget.
    ...q.options.flatMap((o, i) => {
      // A label too wide for its row wraps under itself (compose at 45).
      const rows: Row[] = [
        ...lead(
          [cur(i), [`${i + 1}.`, "g"], [" "], ...box(m.ticked.includes(i))],
          [[" ".repeat(indent)]],
          plain(o.label, m.cursor === i ? "l" : undefined),
          cols - indent,
        ),
        ...lead(
          [[" ".repeat(indent)]],
          [[" ".repeat(indent)]],
          plain(o.description, "g"),
          cols - indent,
        ),
      ];
      rows[rows.length - 1] = { ...rows[rows.length - 1], cls: "gap" };
      return rows.map((r): Row => ({ ...r, opt: i }));
    }),
    {
      input: m.typed ? 2 + `${n + 1}. `.length + (q.multiSelect ? 4 : 0) + m.typed.length : undefined,
      segs: [
        cur(n),
        ...(m.typed
          ? [[`${n + 1}. `, "g"] as Seg, ...box(true), [m.typed] as Seg]
          : q.multiSelect
            ? [
                [`${n + 1}. `, "g"] as Seg,
                ...box(false),
                ["Type something", "g"] as Seg,
              ]
            : [[`${n + 1}. Type something.`, "g"] as Seg]),
      ],
    },
    ...(q.multiSelect
      ? [{ segs: [cur(n + 1), ["   "], ["Next", "b"]] } as Row]
      : []),
    rule,
    m.cursor === n + (q.multiSelect ? 2 : 1)
      ? { segs: [["❯ ", "l"], [`${n + 2}. Chat about this`, "l"]] }
      : { segs: [["  "], [`${n + 2}. Chat about this`]] },
    BLANK,
    ...wrap(plain(footer, "g"), cols).map((l): Row => ({ segs: segs(l) })),
  ];
}

/** The tab row as Claude Code lays it out: each header padded, ticked once
 * answered. Headers that don't fit share the room, cut with "…", the current
 * one taking up to half; if the tabs still overflow, each shrinks and its text
 * wraps, as on the recorded review screen at 45 columns. */
function tabRows(d: Dialog, m: Moment, cols: number): Row[] {
  const qs = d.questions;
  // One question: its header alone, as recorded.
  if (qs.length === 1) return [{ segs: [[` ☐ ${qs[0].header} `, "tab"]] }];
  const review = m.q === qs.length;
  const cut = (s: string, w: number) => (s.length > w ? s.slice(0, Math.max(0, w - 1)) + "…" : s);
  const room = cols - "← ".length - " →".length - " ✔ Submit ".length;
  const fits = qs.reduce((n, q) => n + 4 + q.header.length, 0) <= room;
  const mine = Math.min(4 + (qs[m.q]?.header.length ?? 0), room / 2);
  const others = Math.max(6, Math.floor((room - mine) / Math.max(qs.length - 1, 1)));
  const items: Cell[][] = [
    plain("← "),
    ...qs.map((q, i) => {
      // Ticked once answered, or, on a multi-select, once anything is picked.
      const picked = i === m.q && q.multiSelect && (m.ticked.length > 0 || !!m.typed);
      const header = fits ? q.header : cut(q.header, (i === m.q ? mine : others) - 4);
      return plain(` ${i < m.q || picked ? "☒" : "☐"} ${header} `, i === m.q ? "tab" : undefined);
    }),
    plain(" ✔ Submit ", review ? "tab" : undefined),
    plain(" →", review ? "g" : undefined),
  ];
  return beside(items, shrink(items.map((c) => c.length), cols)).map((r) => ({ segs: segs(r) }));
}

/** Texts side by side at the given widths, each wrapped in its own, rows
 * padded so the next starts at its column. */
function beside(texts: Cell[][], widths: number[], trim = false): Cell[][] {
  // `trim`: a row after the first loses its leading space, as option labels do.
  const wrapped = texts.map((c, i) =>
    wrapInk(c, widths[i]).map((r, k) => (trim && k ? r.slice(Math.max(0, r.findIndex(([ch]) => ch !== " "))) : r)),
  );
  return Array.from({ length: Math.max(...wrapped.map((w) => w.length)) }, (_, r) =>
    wrapped.flatMap((w, i) => [...(w[r] ?? []), ...plain(" ".repeat(Math.max(0, widths[i] - (w[r] ?? []).length)))]),
  );
}

/** A question with previews, as Claude Code lays it out: the options in 30
 * columns, no descriptions, the cursor's bold; 4 columns on, the cursor's
 * preview in a box filling the rest, its text cut after ROWS - 26 rows with an
 * amber "✂ N lines hidden" rule; "Notes:" under it. Below about 62 columns
 * both sides shrink and wrap, as recorded at 45. */
/** A preview's line as Claude Code draws its markdown: `code` in lavender,
 * ticks dropped, a bullet indented up to 3 spaces drawn "- " at the margin
 * with one space after it (recorded: "  +   key" as "- key"), a backslash
 * ending the line dropped (the space before it stays), the rest as written. */
const ticks = (line: string): Cell[] =>
  line
    .replace(/^ {0,3}[-+*] +/, "- ")
    .replace(/\\$/, "")
    .split("`")
    .flatMap((part, k) => plain(part, k % 2 ? "l" : undefined));

/** The most rows the notes field shows while typed in. */
const NOTE_ROWS = 5;

function previewRows(d: Dialog, q: Dialog["questions"][number], m: Moment, cols: number, max: number): Row[] {
  const cursor = m.shown;
  const LIST = 30;
  const GAP = 4;
  // The box fits the dialog's widest preview line, any question's, up to the
  // room left, and is never under 44 columns (recorded: a widest line of 38
  // drew 44; 41 to 73 drew widest + 4): every question's box is that wide.
  // A preview is trimmed first, so its first line's indent counts for nothing.
  const widest = Math.max(
    ...d.questions.flatMap((x) =>
      x.options.flatMap((o) => (o.preview ?? "").trim().split("\n").map((l) => ticks(l).length)),
    ),
  );
  const boxW = Math.min(cols - LIST - GAP, Math.max(44, widest + 4));
  const inner = Math.max(1, boxW - 4);
  const lines = (q.options[cursor]?.preview ?? "No preview available")
    .trim()
    .split("\n")
    .flatMap((l) => wrapInk(ticks(l), inner));
  const hidden = Math.max(0, lines.length - max);
  const scissors = `├─── ✂ ─── ${hidden} lines hidden `;
  const side = (cells: Cell[]): Cell[] => [
    ...plain("│ ", "g"),
    ...cells,
    ...plain(" ".repeat(Math.max(0, inner - cells.length))),
    ...plain(" │", "g"),
  ];
  const box: Cell[][] = [
    plain(`┌${"─".repeat(boxW - 2)}┐`, "g"),
    ...lines.slice(0, max).map(side),
    ...(hidden ? [plain(scissors + "─".repeat(Math.max(0, boxW - 1 - scissors.length)) + "┤", "amb")] : []),
    plain(`└${"─".repeat(boxW - 2)}┘`, "g"),
  ];
  // Notes: a grey hint; with n, a dim placeholder, then the notes typed.
  const notes = m.noting
    ? m.notes
      ? plain(m.notes)
      : plain("Add notes on this design…", "d")
    : plain("press n to add notes", "g i");
  const [listW, rightW] = shrink(
    [LIST, Math.max(cols - LIST - GAP, hidden ? scissors.length + 1 : 0, "Notes: ".length + "press n to add notes".length)],
    cols - GAP,
  );
  // The notes field keeps its last column for the cursor; a row after the
  // first loses its leading space.
  // While typed in, the field takes the columns the list's 30 leave, and
  // shows its last rows: at 45 columns, 3 columns (chain, skills). The hint
  // before it takes the right column's width. A row after the field's first
  // loses its leading space.
  const noteW = m.noting ? cols - LIST - GAP - "Notes: ".length - 1 : rightW - "Notes: ".length;
  const noted = wrapInk(notes, noteW);
  const from = m.noting ? Math.max(0, noted.length - NOTE_ROWS) : 0;
  const noteRows = noted.slice(from).map((l, k) => [
    ...(k ? plain("       ") : [...plain("Notes:", "l"), ...plain(" ")]),
    ...(from + k ? l.slice(Math.max(0, l.findIndex(([ch]) => ch !== " "))) : l),
  ]);
  const right: Cell[][] = [...box.flatMap((r) => wrapInk(r, rightW)), [], ...noteRows];
  // An option is three texts in a row: the cursor, the number, the label. The
  // label counts as wide as it wraps in the column; when the three overflow,
  // each shrinks and wraps, so the number can break, as recorded at 45.
  const owner: number[] = [];
  const left: Cell[][] = q.options.flatMap((o, i) => {
    const on = i === cursor;
    const texts = [
      plain(on ? "❯" : " ", on ? "l" : undefined),
      plain(` ${i + 1}.`, "g"),
      plain(` ${o.label}`, on ? "l b" : undefined),
    ];
    const widest = (c: Cell[]) => Math.max(...wrapInk(c, listW).map((r) => r.length));
    const rows = beside(texts, shrink(texts.map(widest), listW), true);
    owner.push(...rows.map(() => i));
    return rows;
  });
  // The text cursor ends the notes typed, or starts the placeholder.
  const field = right.length - 1;
  const caret = listW + GAP + right[field].length - (m.notes ? 0 : notes.length);
  return Array.from({ length: Math.max(left.length, right.length) }, (_, r): Row => {
    const l = left[r] ?? [];
    return {
      segs: segs([...l, ...plain(" ".repeat(listW + GAP - l.length)), ...(right[r] ?? [])]),
      opt: owner[r],
      input: m.noting && r === field ? caret : undefined,
    };
  });
}
