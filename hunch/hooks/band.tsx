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
  const opened = row !== f.row ? rows[row].findIndex((i) => i.mark === "open") : -1;
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

const textOf = (i: Item) =>
  i.kind === "chip"
    ? `[ ${i.mark === "open" ? "▾ " : ""}${i.label} ]`
    : i.mark === "done"
      ? `${i.label} ✓`
      : i.mark === "running"
        ? `${i.label} ●`
        : i.label;

/** Where every item sits, one screen row per item row, clipped to `columns`. */
export function layout(b: Band, columns: number): Cell[] {
  const cells: Cell[] = [];
  const boxed = b.chips.length > 0 && b.body.length > 0;
  const place = (items: Item[], y: number, x0: number, gap: number) => {
    const end = columns - x0;
    let x = x0;
    for (const item of items) {
      const left = end - x;
      if (left <= 1) break;
      const full = textOf(item);
      const text = full.length > left ? `${full.slice(0, left - 1)}…` : full;
      cells.push({ item, text, x, y });
      x += text.length + gap;
    }
  };
  let y = 0;
  if (b.chips.length) place(b.chips, y++, 0, 1);
  if (b.body.length) {
    if (boxed) y++;
    for (const r of b.body) place(r, y++, boxed ? 2 : 0, 2);
    if (boxed) y++;
  }
  if (b.agents.length) place(b.agents, y, 0, 2);
  return cells;
}

export function hit(cells: Cell[], x: number, y: number): Item | undefined {
  return cells.find((c) => c.y === y && x >= c.x && x < c.x + c.text.length)
    ?.item;
}

export default function BandView(band: Band, surface: any) {
  const { Box, Text } = surface.elements;
  const rows = navRows(band);
  const cells = layout(band, surface.columns || 200);
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
    const item = hit(cells, p.x, p.y);
    if (item && focusable(item)) choose(item);
  });

  const draw = (c: Cell) => {
    const i = c.item;
    const style: Record<string, unknown> = { children: c.text };
    if (i.kind === "quiet" || i.kind === "note") style.dimColor = true;
    if (i.mark === "done") style.color = "green";
    if (i.mark === "running") style.color = "yellow";
    if (i.mark === "open") style.bold = true;
    if (i.id === at) style.inverse = true;
    return Box({ key: `c-${i.id}`, children: [Text(style)] });
  };
  const byRow = new Map<number, Cell[]>();
  for (const c of cells) byRow.set(c.y, [...(byRow.get(c.y) ?? []), c]);
  const line = (y: number, gap: number) =>
    Box({
      key: `y-${y}`,
      flexDirection: "row",
      gap,
      children: (byRow.get(y) ?? []).map(draw),
    });

  const boxed = band.chips.length > 0 && band.body.length > 0;
  const out = [];
  let y = 0;
  if (band.chips.length) out.push(line(y++, 1));
  if (band.body.length) {
    if (boxed) y++;
    const body = band.body.map(() => line(y++, 2));
    if (boxed) y++;
    out.push(
      boxed
        ? Box({
            key: "body",
            borderStyle: "round",
            paddingX: 1,
            flexDirection: "column",
            children: body,
          })
        : Box({ key: "body", flexDirection: "column", children: body }),
    );
  }
  if (band.agents.length) out.push(line(y, 2));
  return Box({ flexDirection: "column", children: out });
}
