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
};
/** `doc`: markdown read below the rows (the pane's result or file); "" for none. */
export type Band = { chips: Item[]; body: Item[][]; doc: string };

/** The widest a card's line runs, in the band's box or the pane: past it, text is hard to read back. */
export const MEASURE = 120;
/** `nav`: the arrows have moved it, so Enter acts here rather than meaning the prompt. */
export type Focus = { row: number; col: number; nav?: true };
export type Cell = { item: Item; text: string; x: number; y: number };

const focusable = (i: Item) => i.kind !== "note" && i.kind !== "title";

export function navRows(b: Band): Item[][] {
  return [b.chips, ...b.body]
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
    pre: button ? `[ ${i.open ? "▾ " : ""}` : "",
    label: i.label,
    glyph: i.state ? GLYPH[i.state] : "",
    post: button ? " ]" : "",
  };
}

const textOf = (i: Item) => {
  const p = pieces(i);
  return p.pre + p.label + p.glyph + p.post;
};

// The card body sits in a box only under chips (the pane shows it bare).
const boxed = (b: Band) => b.chips.length > 0 && b.body.length > 0;

export type Line = {
  part: "chips" | "body";
  gap: number;
  /** Where the line's row starts; a run-on line's first cell sits further in. */
  x0: number;
  y: number;
  cells: Cell[];
};

/** The one row plan: every line and where each item sits in it; a card line wraps at the measure. */
export function layout(b: Band, columns: number): Line[] {
  const box = boxed(b);
  const lines: Line[] = [];
  let y = 0;
  const place = (
    part: Line["part"],
    items: Item[],
    x0: number,
    gap: number,
    width = columns,
  ) => {
    const cells: Cell[] = [];
    let x = x0;
    for (const [n, item] of items.entries()) {
      const left = width - x0 - x;
      if (left <= 1) break;
      const full = textOf(item);
      // Wrapping, the row's last item runs on below itself, aligned at its column.
      if (part === "body" && n === items.length - 1 && full.length > left) {
        const [head, ...rest] = wrap(full, left);
        cells.push({ item, text: head, x, y });
        lines.push({ part, gap, x0, y: y++, cells });
        for (const text of rest) lines.push({ part, gap, x0, y, cells: [{ item, text, x, y: y++ }] });
        return;
      }
      const text = full.length > left ? `${full.slice(0, left - 1)}…` : full;
      cells.push({ item, text, x, y });
      x += text.length + gap;
    }
    lines.push({ part, gap, x0, y: y++, cells });
  };
  if (b.chips.length) place("chips", b.chips, 0, 1);
  if (box) y++; // the box's top border
  for (const r of b.body) place("body", r, box ? 2 : 0, 2, Math.min(columns, MEASURE));
  if (box) y++; // its bottom border
  return lines;
}

/** Words into lines of at most `width`; a list item's later lines hang under its text. */
export function wrap(text: string, width: number): string[] {
  const hang = text.startsWith("• ") ? "  " : "";
  const out: string[] = [];
  let cur = "";
  const words = text.split(" ").filter(Boolean);
  // A bullet stays with its first word.
  if (hang && words.length > 1) words.splice(0, 2, `• ${words[1]}`);
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

/** Whether a card's rows, wrapped in the band's box, take at most `most` lines. The rest go to the pane. */
export function fitsBox(rows: Item[][], columns: number, most: number): boolean {
  return layout({ chips: [{ id: "", label: "", kind: "chip" }], body: rows, doc: "" }, columns)
    .filter((l) => l.part === "body").length <= most;
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
  });
  surface.onPointer((p: { type: string; x: number; y: number }) => {
    if (p.type !== "down") return;
    const item = hit(lines, p.x, p.y);
    if (item && focusable(item)) choose(item);
  });

  // Colour carries state only, by theme key so it follows the user's theme:
  // what is open in the engine's selection blue, ✓ and ● in their colours.
  // Brackets recede so the words stand; hover marks what takes a click.
  const draw = (c: Cell) => {
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
    return Box({ key: `c-${i.id}`, children: [Text(style)] });
  };
  const row = (l: Line) =>
    Box({
      key: `y-${l.y}`,
      flexDirection: "row",
      paddingLeft: (l.cells[0]?.x ?? l.x0) - l.x0,
      gap: l.gap,
      children: l.cells.map(draw),
    });
  const body = lines.filter((l) => l.part === "body").map(row);
  const out = [
    ...lines.filter((l) => l.part === "chips").map(row),
    ...(body.length
      ? [
          boxed(band)
            ? Box({
                key: "body",
                width: Math.min(surface.columns || 200, MEASURE),
                borderStyle: "round",
                borderColor: "subtle",
                paddingX: 1,
                flexDirection: "column",
                children: body,
              })
            : Box({ key: "body", flexDirection: "column", children: body }),
        ]
      : []),
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
