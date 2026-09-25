// Drawn inside the band and the pane. The engine's ring moves the same way on every
// arrow, and a Button pressed inside a Client keeps the keys from it; so items are
// text, a click is hit-tested here, and left/right move along a row, up/down between rows.

export type Item = {
  id: string;
  label: string;
  kind: "chip" | "line" | "quiet" | "note" | "title";
  /** Its card or pane is showing. */
  open?: true;
  state?: "done" | "running";
  /** An agent already read: kept for reopening, drawn dim. */
  read?: true;
  /** A row's first item sits this far in: an answer under its question. */
  indent?: number;
  /** A card's first column: every such cell takes the widest one's width, so the rows read as a table. */
  column?: true;
};
/** `doc`: markdown read below the rows (the pane's result or file); "" for none. */
export type Band = { chips: Item[]; body: Item[][]; doc: string };

/** The pane's width, padding included: its text runs about 72 characters, past which a line is hard to read back. */
export const MEASURE = 76;
/** `nav`: the arrows have moved it, so Enter acts here rather than meaning the prompt. */
export type Focus = { row: number; col: number; nav?: true };
export type Cell = { item: Item; text: string; x: number; y: number };

const focusable = (i: Item) => i.kind !== "note" && i.kind !== "title";

export function navRows(b: Band): Item[][] {
  return [...b.body, b.chips]
    .map((r) => r.filter(focusable))
    .filter((r) => r.length);
}

export function move(f: Focus, rows: Item[][], key: string): Focus {
  if (!rows.length) return { row: 0, col: 0 };
  const row =
    key === "down"
      ? Math.min(f.row + 1, rows.length - 1)
      : key === "up"
        ? Math.max(f.row - 1, 0)
        : Math.min(f.row, rows.length - 1);
  const width = rows[row].length;
  // Stepping back to the chips lands on the open one.
  const opened =
    row !== f.row ? rows[row].findIndex((i) => i.open) : -1;
  const col =
    opened >= 0
      ? opened
      : key === "right"
        ? Math.min(f.col + 1, width - 1)
        : key === "left"
          ? Math.max(f.col - 1, 0)
          : Math.min(f.col, width - 1);
  return { row, col };
}

const GLYPH = { done: " ✓", running: " ●" };
const GLYPH_COLOR = { done: "success", running: "warning" };

/** An item's text in its pieces: brackets for what acts like a button, a state glyph. */
function pieces(i: Item) {
  const button = i.kind === "chip" || i.id === "close";
  return {
    pre: button ? `[ ${i.open ? "▴ " : ""}` : "",
    label: i.label,
    glyph: i.state ? GLYPH[i.state] : "",
    post: button ? " ]" : "",
  };
}

const textOf = (i: Item) => {
  const p = pieces(i);
  return p.pre + p.label + p.glyph + p.post;
};

export type Line = {
  part: "chips" | "body";
  y: number;
  cells: Cell[];
};

/** The one row plan: every line and where each item sits in it. In a card, an item that won't
 * fit the rest of its line starts the next one, and one wider than a line wraps at its column. */
export function layout(b: Band, columns: number): Line[] {
  const lines: Line[] = [];
  let y = 0;
  const place = (
    part: Line["part"],
    items: Item[],
    gap: number,
    width = columns,
    column = 0,
  ) => {
    const start = items[0]?.indent ?? 0;
    let cells: Cell[] = [];
    let x = start;
    const end = () => {
      lines.push({ part, y: y++, cells });
      cells = [];
      x = start;
    };
    // A table row keeps its columns: what follows the first wraps inside its own.
    const flows = part === "body" && !(column && items[0]?.column);
    for (const [n, item] of items.entries()) {
      const full = textOf(item);
      if (flows && cells.length && full.length > width - x && full.length <= width - start) end();
      const left = width - x;
      if (left <= 1) break;
      // Wrapping, the row's last item runs on below itself, aligned at its column.
      if (part === "body" && n === items.length - 1 && (full.length > left || full.includes("\n"))) {
        const at = x;
        const [head, ...rest] = wrap(full, left);
        cells.push({ item, text: head, x, y });
        end();
        for (const text of rest) lines.push({ part, y, cells: [{ item, text, x: at, y: y++ }] });
        return;
      }
      const text = full.length > left ? `${full.slice(0, left - 1)}…` : full;
      cells.push({ item, text, x, y });
      x += Math.max(text.length, item.column ? column : 0) + gap;
    }
    end();
  };
  // A first column wider than half the line would squeeze the rest: its rows flow instead.
  const measure = Math.min(columns, MEASURE);
  const widest = Math.max(0, ...b.body.flat().filter((i) => i.column).map((i) => textOf(i).length));
  const column = widest <= measure / 2 ? widest : 0;
  for (const r of b.body) place("body", r, 2, measure, column);
  if (b.chips.length) place("chips", b.chips, 1);
  return lines;
}

/** Words into lines of at most `width`; a list item's later lines hang under its text, and a
 * blank line in the text stays a blank line. */
export function wrap(text: string, width: number): string[] {
  return text.split("\n").flatMap((p) => (p.trim() ? wrapLine(p, width) : [""]));
}

function wrapLine(text: string, width: number): string[] {
  const hang = /^[•◦] /.test(text) ? "  " : "";
  const out: string[] = [];
  let cur = "";
  const words = text.split(" ").filter(Boolean);
  // A bullet stays with its first word.
  if (hang && words.length > 1) words.splice(0, 2, `${words[0]} ${words[1]}`);
  for (const w of words) {
    if (!cur) cur = (out.length ? hang : "") + w;
    else if (cur.length + 1 + w.length <= width) cur += ` ${w}`;
    else {
      out.push(cur);
      cur = hang + w;
    }
  }
  if (cur) out.push(cur);
  // A word wider than the line is the one thing still clipped.
  return out.map((l) => (l.length > width ? `${l.slice(0, width - 1)}…` : l));
}

export function hit(lines: Line[], x: number, y: number): Item | undefined {
  return lines
    .find((l) => l.y === y)
    ?.cells.find((c) => x >= c.x && x < c.x + c.text.length)?.item;
}

export default function BandView(band: Band, surface: any) {
  const { Box, Text, Markdown } = surface.elements;
  const rows = navRows(band);
  const lines = layout(band, surface.columns || 200);
  const f = move(surface.state ?? { row: 0, col: 0 }, rows, "");
  // Focus is drawn only once this instance has taken a click or a key.
  const at = surface.state ? rows[f.row]?.[f.col]?.id : undefined;

  const choose = (item: Item) => {
    const r = rows.findIndex((row) => row.includes(item));
    if (r >= 0) surface.setState({ row: r, col: rows[r].indexOf(item) });
    surface.post({ act: item.id });
  };
  // Re-set each call so the listeners see these props; keys can outrun a redraw,
  // so each reads the focus afresh.
  surface.onKey((k: { key: string }) => {
    // A typed character was meant for the prompt: send it there, and the keys follow. Posts in
    // one frame replace each other, so each carries all typed here; the hook fills what's new.
    if ([...k.key].length === 1) {
      surface.typed = (surface.typed ?? "") + k.key;
      return surface.post({ type: surface.typed });
    }
    const state: Focus = surface.state ?? { row: 0, col: 0 };
    const now = move(state, rows, "");
    if (["up", "down", "left", "right"].includes(k.key)) surface.setState({ ...move(now, rows, k.key), nav: true });
    else if (k.key === "return" && state.nav) {
      const item = rows[now.row]?.[now.col];
      if (item) choose(item);
    }
    // Enter after a click, or Tab, meant the prompt: hand the keys back to it.
    else if (k.key === "return" || k.key === "tab") surface.post({ release: true });
    // Esc past a focused button: drop the focus and close the pane through the same
    // path as the pane's own close item, not a bespoke message.
    else if (k.key === "escape") {
      surface.setState({ ...now, nav: undefined });
      surface.post({ act: "close" });
    }
  });
  surface.onPointer((p: { type: string; x: number; y: number }) => {
    if (p.type !== "down") return;
    const item = hit(lines, p.x, p.y);
    if (item && focusable(item)) choose(item);
  });

  // Colour carries state only, by theme key so it follows the user's theme:
  // what is open in the engine's selection blue, ✓ and ● in their colours.
  // Brackets recede so the words stand; hover marks what takes a click.
  const draw = (c: Cell, marginLeft: number) => {
    const i = c.item;
    const p = pieces(i);
    const style: Record<string, unknown> = {};
    // A clipped cell draws as one run; its pieces no longer line up.
    style.children =
      c.text !== textOf(i) || i.open
        ? c.text
        : [
            p.pre && Text({ key: "pre", color: "subtle", children: p.pre }),
            p.label,
            p.glyph && Text({ key: "g", color: GLYPH_COLOR[i.state!], children: p.glyph }),
            p.post && Text({ key: "post", color: "subtle", children: p.post }),
          ].filter(Boolean);
    if (i.kind === "quiet" || i.kind === "note" || i.read) style.dimColor = true;
    if (i.open) Object.assign(style, { bold: true, color: "suggestion" });
    if (i.kind === "title") style.bold = true;
    if (focusable(i)) style.hover = { color: "suggestion" };
    if (i.id === at) style.inverse = true;
    return Box({ key: `c-${i.id}`, marginLeft, children: [Text(style)] });
  };
  const row = (l: Line) =>
    Box({
      key: `y-${l.y}`,
      flexDirection: "row",
      // A blank line holds its row, so what's drawn stays where a click is read.
      height: 1,
      // Each cell sits at its planned x: a column's padding is space, not text.
      children: l.cells.map((c, n) => draw(c, c.x - (n ? l.cells[n - 1].x + l.cells[n - 1].text.length : 0))),
    });
  const body = lines.filter((l) => l.part === "body").map(row);
  const out = [
    ...(body.length
      ? [Box({ key: "body", flexDirection: "column", children: body })]
      : []),
    ...lines.filter((l) => l.part === "chips").map(row),
    ...(band.doc
      ? [
          Box({
            key: "doc",
            marginTop: 1,
            children: [
              // A Client's Markdown takes no link handler: its links are listed as rows instead.
              Markdown({ key: "md", text: band.doc }),
            ],
          }),
        ]
      : []),
  ];
  return Box({ flexDirection: "column", children: out });
}
