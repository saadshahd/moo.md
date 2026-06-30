import type { Axis } from "./axis.js";
import { containsPoint, expandRect, type Edges } from "./rect.js";

export const TILE_FLOOR = 24;

/** Sticky margin around the active tile: the pointer holds the current tile while
 *  within its expanded rect, so a tile does not flip the instant the pointer
 *  grazes a band boundary. Shared by every pointer-driven move (drag + carry). */
export const TILE_HYSTERESIS: Edges = { top: 8, right: 8, bottom: 8, left: 8 };

/** 1px horizontal line from the container's left edge to the marker's left edge,
 *  at the marker's vertical center. Width is clamped to 0 when the marker is
 *  flush with or left of the container — the caller filters degenerate widths. */
export const leaderRect = (
  containerRect: DOMRect,
  marker: DOMRect,
): DOMRect => {
  const width = Math.max(0, marker.left - containerRect.left);
  return new DOMRect(
    containerRect.left,
    marker.top + marker.height / 2,
    width,
    1,
  );
};

export type Tile = { slotKey: string; rect: DOMRect };

type Point = { x: number; y: number };

/** Discrete marker size. The marker hosts the slot label; clamping the marker
 *  inside its container clamps the only information-bearing element there. */
export const DISCRETE_MARKER = { width: 160, height: 24, gap: 4 } as const;

/** Confine an interval of `length` to `[lo, hi]`: snap a marker that would spill
 *  past either edge flush to that edge. Degenerate spans (length exceeds the
 *  container) pin to the low edge. */
const confine = (
  start: number,
  length: number,
  lo: number,
  hi: number,
): number => Math.min(Math.max(start, lo), Math.max(lo, hi - length));

/** Vertical center of a discrete stack's `index`-th slot when no child geometry
 *  anchors it: equal-height markers centered as a column over the container. */
const stackedTop = (
  containerRect: DOMRect,
  count: number,
  index: number,
): number => {
  const { height, gap } = DISCRETE_MARKER;
  const total = count * height + (count - 1) * gap;
  return (
    containerRect.top +
    (containerRect.height - total) / 2 +
    index * (height + gap)
  );
};

/** Discrete drop markers anchored to real child geometry: each marker's center
 *  rides its slot's child-rect midpoint, falling back to a centered stack slot
 *  when the slot has no measured children. Every marker is clamped inside the
 *  container so its label never paints outside the box it names. Scattered
 *  children → markers at their actual y, not an equidistant column. */
export const discreteMarkers = (
  tiling: Extract<Tiling, { kind: "discrete" }>,
  containerRect: DOMRect,
): readonly Tile[] => {
  const { width, height } = DISCRETE_MARKER;
  const count = tiling.slots.length;
  const left = containerRect.left + (containerRect.width - width) / 2;
  return tiling.slots.map((slot, index) => {
    const midpoint = slot.rect
      ? slot.rect.top + slot.rect.height / 2
      : stackedTop(containerRect, count, index) + height / 2;
    const top = confine(
      midpoint - height / 2,
      height,
      containerRect.top,
      containerRect.bottom,
    );
    return {
      slotKey: slot.slotKey,
      rect: new DOMRect(
        confine(left, width, containerRect.left, containerRect.right),
        top,
        width,
        height,
      ),
    };
  });
};

/** Active tile under the pointer: the current tile holds while the point stays
 *  within its hysteresis-expanded rect (sticky), else the tile that contains the
 *  point. The one hit-test for which slot a pointer aims at — drag and carry both
 *  resolve the deepest container's slot through here, so both stay in parity. */
export const aimedTile = (
  tiling: Extract<Tiling, { kind: "tiled" }>,
  point: Point,
  current?: string,
): Tile | undefined => {
  const cur = tiling.tiles.find((t) => t.slotKey === current);
  if (cur && containsPoint(expandRect(cur.rect, TILE_HYSTERESIS), point))
    return cur;
  return tiling.tiles.find((t) => containsPoint(t.rect, point));
};

/** The discrete marker the pointer aims at: a scattered/interleaved container
 *  paints no bands, but its labelled markers are real targets — pointing at a
 *  marker's painted rect resolves that marker's slot. Sticky like `aimedTile`:
 *  the current marker holds while the point stays within its expanded rect.
 *  Drag and carry both hit-test the same `discreteMarkers` geometry here. */
export const aimedMarker = (
  tiling: Extract<Tiling, { kind: "discrete" }>,
  containerRect: DOMRect,
  point: Point,
  current?: string,
): Tile | undefined => {
  const markers = discreteMarkers(tiling, containerRect);
  const cur = markers.find((m) => m.slotKey === current);
  if (cur && containsPoint(expandRect(cur.rect, TILE_HYSTERESIS), point))
    return cur;
  return markers.find((m) => containsPoint(m.rect, point));
};

export type Tiling =
  | {
      kind: "tiled";
      axis: Axis;
      tiles: readonly Tile[];
      yielded: readonly string[];
      carved: readonly string[];
    }
  | { kind: "discrete"; slots: readonly SlotInput[] };

export type SlotInput = { slotKey: string; rect?: DOMRect };

type Interval = { start: number; end: number };

type Band = { slotKey: string; band: Interval };

type AxisGeometry = {
  lo: (r: DOMRect) => number;
  hi: (r: DOMRect) => number;
  build: (band: Interval, container: DOMRect) => DOMRect;
};

const AXIS_GEOMETRY: Record<Axis, AxisGeometry> = {
  vertical: {
    lo: (r) => r.top,
    hi: (r) => r.bottom,
    build: (band, c) =>
      new DOMRect(c.left, band.start, c.width, band.end - band.start),
  },
  horizontal: {
    lo: (r) => r.left,
    hi: (r) => r.right,
    build: (band, c) =>
      new DOMRect(band.start, c.top, band.end - band.start, c.height),
  },
};

const extent = (iv: Interval): number => iv.end - iv.start;

/** Remove `cut` from `band`. Full containment collapses to a zero-width
 *  interval at the cut's start; an edge overlap trims that edge; no overlap
 *  returns the band unchanged. Assumes `cut` does not split `band` in two. */
const subtractInterval = (band: Interval, cut: Interval): Interval => {
  if (band.start >= cut.end || band.end <= cut.start) return band;
  if (band.start >= cut.start && band.end <= cut.end)
    return { start: cut.start, end: cut.start };
  if (cut.start <= band.start) return { start: cut.end, end: band.end };
  return { start: band.start, end: cut.start };
};

const byStart = <T extends { band: Interval }>(a: T, b: T): number =>
  a.band.start - b.band.start;

const clamp = (interval: Interval, bounds: Interval): Interval => ({
  start: Math.min(Math.max(interval.start, bounds.start), bounds.end),
  end: Math.max(Math.min(interval.end, bounds.end), bounds.start),
});

const projection = (
  rect: DOMRect,
  axis: Axis,
  container: DOMRect,
): Interval => {
  const g = AXIS_GEOMETRY[axis];
  return clamp(
    { start: g.lo(rect), end: g.hi(rect) },
    { start: g.lo(container), end: g.hi(container) },
  );
};

/** Cleanly ordered, non-interleaved: sort by start, no interval overlaps the
 *  next (touching is OK). */
const isOrdered = (intervals: readonly Interval[]): boolean => {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  return sorted.every((iv, i) => i === 0 || sorted[i - 1].end <= iv.start);
};

const spread = (intervals: readonly Interval[]): number =>
  Math.max(...intervals.map((iv) => iv.end)) -
  Math.min(...intervals.map((iv) => iv.start));

const discrete = (slots: readonly SlotInput[]): Tiling => ({
  kind: "discrete",
  slots,
});

const toTiling = (
  bands: readonly Band[],
  yielded: readonly string[],
  carved: readonly string[],
  axis: Axis,
  container: DOMRect,
): Tiling => {
  const g = AXIS_GEOMETRY[axis];
  return {
    kind: "tiled",
    axis,
    tiles: [...bands]
      .sort(byStart)
      .map((b) => ({ slotKey: b.slotKey, rect: g.build(b.band, container) })),
    yielded,
    carved,
  };
};

/** Equal split of the container into one band per slot along `axis`,
 *  in declaration order. All slots are empty → all are carved. */
const equalSplit = (
  slots: readonly SlotInput[],
  axis: Axis,
  container: DOMRect,
): Tiling => {
  const g = AXIS_GEOMETRY[axis];
  const lo = g.lo(container);
  const step = (g.hi(container) - lo) / slots.length;
  return toTiling(
    slots.map((s, i) => ({
      slotKey: s.slotKey,
      band: { start: lo + i * step, end: lo + (i + 1) * step },
    })),
    [],
    slots.map((s) => s.slotKey),
    axis,
    container,
  );
};

/** Bands from intervals in projection order: boundaries at gap midpoints, ends
 *  flush to the container span. Gapless by construction. */
const bandsFrom = (intervals: readonly Band[], span: Interval): Band[] => {
  const ordered = [...intervals].sort(byStart);
  return ordered.map((p, i) => ({
    slotKey: p.slotKey,
    band: {
      start:
        i === 0 ? span.start : (ordered[i - 1].band.end + p.band.start) / 2,
      end:
        i === ordered.length - 1
          ? span.end
          : (p.band.end + ordered[i + 1].band.start) / 2,
    },
  }));
};

/** Sub-floor measured bands yield; their span is reabsorbed by re-splitting the
 *  survivors over the full container span. Survivors only grow → no cascade. */
const absorbSubFloor = (
  bands: readonly Band[],
  span: Interval,
): { kept: Band[]; yielded: string[] } => {
  const surviving = bands.filter((b) => extent(b.band) >= TILE_FLOOR);
  const yielded = bands
    .filter((b) => extent(b.band) < TILE_FLOOR)
    .map((b) => b.slotKey);
  if (!yielded.length) return { kept: [...bands], yielded: [] };
  if (!surviving.length) return { kept: [], yielded };
  return {
    kept: bandsFrom(
      surviving.map((b) => ({ slotKey: b.slotKey, band: b.band })),
      span,
    ),
    yielded,
  };
};

/** Boundary position for an empty slot: midpoint between the bands of its
 *  nearest measured neighbors in declaration order, or the container edge when
 *  it is declaration-first/last. */
const emptyBoundary = (
  declIndex: number,
  slots: readonly SlotInput[],
  bands: Map<string, Interval>,
  span: Interval,
): number => {
  const before = slots
    .slice(0, declIndex)
    .reverse()
    .find((s) => bands.has(s.slotKey));
  const after = slots.slice(declIndex + 1).find((s) => bands.has(s.slotKey));
  if (!before) return span.start;
  if (!after) return span.end;
  return (bands.get(before.slotKey)!.end + bands.get(after.slotKey)!.start) / 2;
};

/** TILE_FLOOR band per empty slot at its interpolated boundary. Consecutive
 *  empties at the same boundary stack in declaration order; a group is pinned
 *  inside the span at the edges, centered otherwise. */
const carveBands = (
  slots: readonly SlotInput[],
  measured: readonly Band[],
  span: Interval,
): Band[] => {
  const bandByKey = new Map(measured.map((b) => [b.slotKey, b.band]));

  const grouped = slots.reduce((acc, s, declIndex) => {
    if (s.rect) return acc;
    const at = emptyBoundary(declIndex, slots, bandByKey, span);
    return acc.set(at, [...(acc.get(at) ?? []), s.slotKey]);
  }, new Map<number, string[]>());

  return [...grouped.entries()].flatMap(([at, keys]) => {
    const total = keys.length * TILE_FLOOR;
    const start =
      at <= span.start
        ? span.start
        : at >= span.end
          ? span.end - total
          : at - total / 2;
    return keys.map((slotKey, i) => ({
      slotKey,
      band: {
        start: start + i * TILE_FLOOR,
        end: start + (i + 1) * TILE_FLOOR,
      },
    }));
  });
};

/** Shrink each measured band by every carved band overlapping it. */
const shrinkAround = (
  measured: readonly Band[],
  carved: readonly Band[],
): Band[] =>
  measured.map((m) => ({
    slotKey: m.slotKey,
    band: carved.reduce((b, c) => subtractInterval(b, c.band), m.band),
  }));

/** Carve TILE_FLOOR bands for empty slots and shrink the survivors around them. */
const carveEmpties = (
  slots: readonly SlotInput[],
  measured: readonly Band[],
  span: Interval,
): Band[] => {
  const carved = carveBands(slots, measured, span);
  return [...shrinkAround(measured, carved), ...carved];
};

/** Axis choice when both projections are ordered: a single measured band
 *  carries no cross-slot geometry, so the container's CSS axis decides;
 *  with 2+ bands the larger spread wins. */
const breakTie = (args: {
  vBands: readonly Band[];
  hBands: readonly Band[];
  measuredCount: number;
  cssAxis?: Axis;
}): Axis => {
  const { vBands, hBands, measuredCount, cssAxis } = args;
  if (measuredCount <= 1 && cssAxis) return cssAxis;
  return spread(vBands.map((b) => b.band)) >= spread(hBands.map((b) => b.band))
    ? "vertical"
    : "horizontal";
};

export const tileSlots = (args: {
  containerRect: DOMRect;
  slots: readonly SlotInput[];
  cssAxis?: Axis;
}): Tiling => {
  const { containerRect, slots, cssAxis } = args;
  if (!slots.length) return discrete(slots);

  const measured = slots.flatMap((s) =>
    s.rect ? [{ slotKey: s.slotKey, rect: s.rect }] : [],
  );

  if (!measured.length) {
    return cssAxis
      ? equalSplit(slots, cssAxis, containerRect)
      : discrete(slots);
  }

  const project = (axis: Axis): Band[] =>
    measured.map((m) => ({
      slotKey: m.slotKey,
      band: projection(m.rect, axis, containerRect),
    }));

  const vBands = project("vertical");
  const hBands = project("horizontal");
  const vOk = isOrdered(vBands.map((b) => b.band));
  const hOk = isOrdered(hBands.map((b) => b.band));
  if (!vOk && !hOk) return discrete(slots);

  const axis: Axis =
    vOk && hOk
      ? breakTie({ vBands, hBands, measuredCount: measured.length, cssAxis })
      : vOk
        ? "vertical"
        : "horizontal";

  const g = AXIS_GEOMETRY[axis];
  const span: Interval = {
    start: g.lo(containerRect),
    end: g.hi(containerRect),
  };
  const measuredBands = bandsFrom(axis === "vertical" ? vBands : hBands, span);
  const { kept, yielded } = absorbSubFloor(measuredBands, span);
  if (!kept.length) return discrete(slots);

  if (slots.every((s) => s.rect))
    return toTiling(kept, yielded, [], axis, containerRect);

  const emptyKeys = slots.filter((s) => !s.rect).map((s) => s.slotKey);
  const carvedBands = carveEmpties(slots, kept, span);
  if (carvedBands.some((b) => extent(b.band) < TILE_FLOOR - 1e-9))
    return discrete(slots);
  return toTiling(carvedBands, yielded, emptyKeys, axis, containerRect);
};
