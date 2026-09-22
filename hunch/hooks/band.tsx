// Drawn inside the band and the pane. The engine's ring moves the same way on every
// arrow, and a Button pressed inside a Client keeps the keys from it; so items are
// text, a click is hit-tested here, and left/right move along a row, up/down between rows.

export type Item = {
  id: string;
  label: string;
  kind: "chip" | "line" | "quiet" | "note" | "agent";
  /** Its card or pane is showing. */
  open?: true;
  state?: "done" | "running";
  /** An agent already read: kept for reopening, drawn dim. */
  read?: true;
};
/** `wrap`: long lines wrap at words (the pane); else they clip (the band). */
export type Band = { chips: Item[]; body: Item[][]; agents: Item[]; wrap: boolean };
export type Focus = { row: number; col: number };
export type Cell = { item: Item; text: string; x: number; y: number };

const focusable = (i: Item) => i.kind !== "note";

export function navRows(b: Band): Item[][] {
  return [b.chips, ...b.body, b.agents]
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
  const button = i.kind === "chip" || i.kind === "agent";
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
  part: "chips" | "body" | "agents";
  gap: number;
  y: number;
  cells: Cell[];
};

/** The one row plan: every line, where each item sits in it, clipped to `columns`. */
export function layout(b: Band, columns: number): Line[] {
  const box = boxed(b);
  const lines: Line[] = [];
  let y = 0;
  const place = (
    part: Line["part"],
    items: Item[],
    x0: number,
    gap: number,
  ) => {
    if (b.wrap && items.length === 1) {
      for (const text of wrap(textOf(items[0]), columns - x0))
        lines.push({ part, gap, y, cells: [{ item: items[0], text, x: x0, y: y++ }] });
      return;
    }
    const cells: Cell[] = [];
    let x = x0;
    for (const item of items) {
      const left = columns - x0 - x;
      if (left <= 1) break;
      const full = textOf(item);
      const text = full.length > left ? `${full.slice(0, left - 1)}…` : full;
      cells.push({ item, text, x, y });
      x += text.length + gap;
    }
    lines.push({ part, gap, y: y++, cells });
  };
  if (b.chips.length) place("chips", b.chips, 0, 1);
  if (box) y++; // the box's top border
  for (const r of b.body) place("body", r, box ? 2 : 0, 2);
  if (box) y++; // its bottom border
  if (b.agents.length) place("agents", b.agents, 0, 2);
  return lines;
}

/** Words into lines of at most `width`; a list item's later lines hang under its text. */
export function wrap(text: string, width: number): string[] {
  const hang = text.startsWith("• ") ? "  " : "";
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(" ").filter(Boolean)) {
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

/** Whether rows fit the band's box: few enough, and none clipped. The rest go to the pane. */
export function fitsBox(rows: Item[][], columns: number, most: number): boolean {
  const width = (r: Item[]) => r.reduce((n, i) => n + textOf(i).length, 0) + 2 * (r.length - 1);
  return rows.length <= most && rows.every((r) => width(r) <= columns - 4);
}

export function hit(lines: Line[], x: number, y: number): Item | undefined {
  return lines
    .find((l) => l.y === y)
    ?.cells.find((c) => x >= c.x && x < c.x + c.text.length)?.item;
}

export default function BandView(band: Band, surface: any) {
  const { Box, Text } = surface.elements;
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
    // A typed character was meant for the prompt: send it there, and the keys follow.
    if ([...k.key].length === 1) return surface.post({ type: k.key });
    const now = move(surface.state ?? { row: 0, col: 0 }, rows, "");
    if (k.key === "return") {
      const item = rows[now.row]?.[now.col];
      if (item) choose(item);
    } else surface.setState(move(now, rows, k.key));
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
    if (focusable(i)) style.hover = { color: "suggestion" };
    if (i.id === at) style.inverse = true;
    return Box({ key: `c-${i.id}`, children: [Text(style)] });
  };
  const row = (l: Line) =>
    Box({
      key: `y-${l.y}`,
      flexDirection: "row",
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
                borderStyle: "round",
                borderColor: "subtle",
                paddingX: 1,
                flexDirection: "column",
                children: body,
              })
            : Box({ key: "body", flexDirection: "column", children: body }),
        ]
      : []),
    ...lines.filter((l) => l.part === "agents").map(row),
  ];
  return Box({ flexDirection: "column", children: out });
}
