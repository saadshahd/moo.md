// Drawn inside the band and the pane. The engine's ring moves the same way on every
// arrow, and a Button pressed inside a Client keeps the keys from it; so items are
// text, a click is hit-tested here, and left/right move along a row, up/down between rows.

export type Item = {
  id: string;
  label: string;
  kind: "chip" | "line" | "quiet" | "note" | "agent";
  mark?: "open" | "done" | "running";
};
export type Band = { chips: Item[]; body: Item[][]; agents: Item[] };
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
    row !== f.row ? rows[row].findIndex((i) => i.mark === "open") : -1;
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

const MARK_GLYPH: Record<string, string> = { done: " ✓", running: " ●" };
const MARK_COLOR: Record<string, string> = {
  done: "success",
  running: "warning",
};

const textOf = (i: Item) =>
  i.kind === "chip"
    ? `[ ${i.mark === "open" ? "▾ " : ""}${i.label} ]`
    : `${i.label}${MARK_GLYPH[i.mark ?? ""] ?? ""}`;

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
  const at = rows[f.row]?.[f.col]?.id;

  const choose = (item: Item) => {
    const r = rows.findIndex((row) => row.includes(item));
    if (r >= 0) surface.setState({ row: r, col: rows[r].indexOf(item) });
    surface.post({ act: item.id });
  };
  // Re-set each call so the listeners see these props; keys can outrun a redraw,
  // so each reads the focus afresh.
  surface.onKey((k: { key: string }) => {
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
  // the open chip in the engine's own selection blue, ✓ and ● in their colours,
  // the label beside them plain. Hover is the one sign that a word takes a click.
  const draw = (c: Cell) => {
    const i = c.item;
    const style: Record<string, unknown> = {};
    const glyph = MARK_GLYPH[i.mark ?? ""];
    style.children =
      glyph && c.text.endsWith(glyph)
        ? [
            c.text.slice(0, -glyph.length),
            Text({ key: "g", color: MARK_COLOR[i.mark!], children: glyph }),
          ]
        : c.text;
    if (i.kind === "quiet" || i.kind === "note") style.dimColor = true;
    if (i.mark === "open")
      Object.assign(style, { bold: true, color: "suggestion" });
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
