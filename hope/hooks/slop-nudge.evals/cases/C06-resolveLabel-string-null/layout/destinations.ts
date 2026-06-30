import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { ComponentData, Data } from "@puckeditor/core";
import {
  collectDescendants,
  findById,
  findParent,
  getChildrenAt,
  preOrder,
  slotKeysOf,
} from "@duckeditor/spec";
import type { FiberRegistry } from "../fiber/index.js";
import { resolveSlotAxis, type Axis } from "./axis.js";
import { containsPoint } from "./rect.js";
import { slotInsertIndex } from "./slot-regions.js";
import { aimedMarker, aimedTile, type Tile, type Tiling } from "./tiles.js";
import { buildTiling } from "./tiling.js";

export const NO_TARGET_LABEL = "No target here";

/** The active drop spec the overlay renders for a pointer-driven move: a slot
 *  insert (container), a between-siblings line, or an explicit no-target marker
 *  over the container the pointer is inside. */
export type DropTarget =
  | {
      kind: "line";
      elementId: string;
      edge: Edge;
      axis: Axis;
      blocked?: boolean;
    }
  | {
      kind: "container";
      elementId: string;
      slotKey: string;
      index: number;
      /** Painted destinations over the container; the active slot is `slotKey`. */
      tiling: Tiling;
      activeLabel: string;
      blocked?: boolean;
    }
  | { kind: "root"; index: number; label: string }
  | { kind: "none"; elementId: string };

/** One reachable drop position in the cycle: a slot append or a between-siblings
 *  insert beside a container. `parentId`/`slotKey` follow spec-ops `move()`:
 *  both null means root content. */
export type Destination = {
  parentId: string | null;
  slotKey: string | null;
  index: number;
  label: string;
};

const ROOT_LABEL = "Root";

/** `Component › slot` qualified destination label. The one source of this
 *  format — tiles, drop-zone labels, and the destination cycle all reuse it. */
export const qualifiedLabel = (
  componentType: string,
  slotKey: string,
): string => `${componentType} › ${slotKey}`;

/** Per-slot qualified labels for a container, keyed by slotKey. */
export const slotLabels = (
  data: Data,
  containerId: string,
): Record<string, string> => {
  const container = findById(data, containerId);
  if (!container) return {};
  return Object.fromEntries(
    slotKeysOf(container).map((slotKey) => [
      slotKey,
      qualifiedLabel(container.type, slotKey),
    ]),
  );
};

/** Display label for a drop target: `Component › slot` for container and line
 *  drops, "Root" for root-level lines, a constant for no-target. Null when the
 *  container is unknown. */
export const resolveLabel = (data: Data, target: DropTarget): string | null => {
  if (target.kind === "none") return NO_TARGET_LABEL;
  if (target.kind === "root") return target.label;
  if (target.kind === "line") {
    const parent = findParent(data, target.elementId);
    if (!parent) return null;
    if (parent.parentId === null || parent.slotKey === null) return ROOT_LABEL;
    const type = findById(data, parent.parentId)?.type;
    return type ? qualifiedLabel(type, parent.slotKey) : null;
  }
  const type = findById(data, target.elementId)?.type;
  return type ? qualifiedLabel(type, target.slotKey) : null;
};

type Located = {
  component: ComponentData;
  depth: number;
  parentId: string | null;
  slotKey: string | null;
  index: number;
};

/** Containers (slot-bearing) whose border rect holds the point, deepest-first.
 *  Excluded element and its descendants are never candidates. Ties on depth
 *  resolve by document order (preOrder yield order). */
const candidateChain = (args: {
  point: { x: number; y: number };
  data: Data;
  registry: FiberRegistry;
  excluded: ReadonlySet<string>;
}): Located[] => {
  const { point, data, registry, excluded } = args;
  return [...preOrder(data)]
    .flatMap(({ component, path }) => {
      const id = component.props.id as string;
      if (excluded.has(id)) return [];
      if (!slotKeysOf(component).length) return [];
      const rect = registry.get(id)?.getBoundingClientRect();
      if (!rect || !containsPoint(rect, point)) return [];
      const last = path[path.length - 1];
      return [
        {
          component,
          depth: path.length,
          parentId: last.parentId,
          slotKey: last.slotKey,
          index: last.index,
        } satisfies Located,
      ];
    })
    .sort((a, b) => b.depth - a.depth);
};

const slotDestinations = (container: ComponentData): Destination[] =>
  slotKeysOf(container).map((slotKey) => ({
    parentId: container.props.id as string,
    slotKey,
    index: (container.props[slotKey] as ComponentData[]).length,
    label: qualifiedLabel(container.type, slotKey),
  }));

const besideDestination = (located: Located, data: Data): Destination => {
  const index = located.index + 1;
  if (located.parentId === null || located.slotKey === null)
    return { parentId: null, slotKey: null, index, label: ROOT_LABEL };
  const parent = findById(data, located.parentId);
  if (!parent)
    throw new Error(`besideDestination: missing parent ${located.parentId}`);
  return {
    parentId: located.parentId,
    slotKey: located.slotKey,
    index,
    label: qualifiedLabel(parent.type, located.slotKey),
  };
};

/** Slot appends of a container's slot-bearing siblings, document-ordered.
 *  Keyboard reach = pointer reach (R9): these slots are nowhere near the
 *  pointer, yet the cycle must enumerate them. Excluded elements and the
 *  container itself contribute nothing. */
const siblingSlotDestinations = (args: {
  located: Located;
  data: Data;
  excluded: ReadonlySet<string>;
}): Destination[] => {
  const { located, data, excluded } = args;
  const selfId = located.component.props.id as string;
  const isExpandable = (sibling: ComponentData): boolean => {
    const id = sibling.props.id as string;
    return id !== selfId && !excluded.has(id) && slotKeysOf(sibling).length > 0;
  };
  return (getChildrenAt(data, located.parentId, located.slotKey) ?? [])
    .filter(isExpandable)
    .flatMap(slotDestinations);
};

/** Deduped drop positions for an already-resolved containment chain: per level,
 *  the container's own slots, then beside-it in its parent, then its slot-bearing
 *  siblings' slots — deepest-first (R9: full reach — sibling slots are enumerable
 *  without pointer movement). Pure derivation from the chain — no DOM access, so
 *  callers that already have the chain reuse it instead of re-running
 *  `candidateChain`.
 *
 *  One global dedup pass on identity (parentId|slotKey): the first occurrence of
 *  each unique slot wins, every later one is dropped. Identity (not label) is the
 *  key so same-type nested containers with identically-named slots are both kept.
 *  This is the cycle's unit — `stackIndexOf` matches on identity ignoring index,
 *  and arrow keys refine the index within a chosen slot. Global dedup subsumes
 *  the old exact-position and consecutive-identity passes: a beside-target and an
 *  ancestor slot-append that share an identity collapse to the earlier one. */
const stackFromChain = (args: {
  chain: Located[];
  data: Data;
  excluded: ReadonlySet<string>;
}): Destination[] => {
  const { chain, data, excluded } = args;
  const all = chain.flatMap((located) => [
    ...slotDestinations(located.component),
    besideDestination(located, data),
    ...siblingSlotDestinations({ located, data, excluded }),
  ]);

  const seen = new Set<string>();
  return all.filter((d) => {
    const key = identityKey(d);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const identityKey = (d: Destination): string =>
  `${d.parentId ?? "root"}|${d.slotKey ?? ""}`;

/** The cycle of discrete drop positions under the pointer: deepest container's
 *  slots, then beside-it in its parent, then its slot-bearing siblings' slots,
 *  repeating up the containment chain to the root. Pure; same inputs → same
 *  output. */
export const destinationStack = (args: {
  point: { x: number; y: number };
  data: Data;
  registry: FiberRegistry;
  excludeId: string;
}): readonly Destination[] => {
  const { point, data, registry, excludeId } = args;
  const excluded = new Set([excludeId, ...collectDescendants(data, excludeId)]);
  return stackFromChain({
    chain: candidateChain({ point, data, registry, excluded }),
    data,
    excluded,
  });
};

/** The slot the pointer aims at inside a container's painted tiling: a band hit
 *  for a tiled container, a labelled-marker hit for a discrete (scattered) one.
 *  Markers are first-class targets — both modalities hit-test the same painted
 *  geometry. Undefined when the pointer lands on no band and no marker. */
const aimedSlotTile = (
  tiling: Tiling,
  containerRect: DOMRect,
  point: { x: number; y: number },
): Tile | undefined =>
  tiling.kind === "tiled"
    ? aimedTile(tiling, point)
    : aimedMarker(tiling, containerRect, point);

/** The pointer-aimed slot destination for a real container: hit-test its painted
 *  tiling (band or marker) with the same geometry as drag, then resolve the
 *  precise insert index from the slot's measured children. Null when the
 *  container is unmounted or the pointer hits neither a band nor a marker — the
 *  caller falls back to the stack head. */
const aimedSlotDestination = (args: {
  container: Located;
  point: { x: number; y: number };
  data: Data;
  registry: FiberRegistry;
}): Destination | null => {
  const { container, point, data, registry } = args;
  const containerId = container.component.props.id as string;
  const containerRect = registry.get(containerId)?.getBoundingClientRect();
  if (!containerRect) return null;
  const { tiling, regions } = buildTiling({ data, containerId, registry });
  const tile = aimedSlotTile(tiling, containerRect, point);
  if (!tile) return null;

  const measured = regions.find((r) => r.slotKey === tile.slotKey);
  const axis =
    resolveSlotAxis(data, containerId, tile.slotKey, registry) ?? "vertical";
  const index = measured
    ? slotInsertIndex({ point, axis, region: measured })
    : (container.component.props[tile.slotKey] as ComponentData[]).length;

  return {
    parentId: containerId,
    slotKey: tile.slotKey,
    index,
    label: qualifiedLabel(container.component.type, tile.slotKey),
  };
};

/** The single destination the pointer aims at: the slot of the deepest container
 *  under the point whose tile band holds it (same hit-test as drag), or the head
 *  of the destination stack when no band is aimed (discrete container, root
 *  content, or a between-bands gap). Undefined when the pointer is over nothing. */
export const aimDestination = (args: {
  point: { x: number; y: number };
  data: Data;
  registry: FiberRegistry;
  excludeId: string;
}): Destination | undefined => {
  const { point, data, registry, excludeId } = args;
  const excluded = new Set([excludeId, ...collectDescendants(data, excludeId)]);
  const chain = candidateChain({ point, data, registry, excluded });
  const stackHead = stackFromChain({ chain, data, excluded })[0];
  const deepest = chain[0];
  if (!deepest) return stackHead;
  return (
    aimedSlotDestination({ container: deepest, point, data, registry }) ??
    stackHead
  );
};

/** Index of a destination within a stack, matched on parent/slot (ignoring the
 *  precise insert index). -1 when the stack has no slot for it. */
export const stackIndexOf = (
  stack: readonly Destination[],
  destination: Destination,
): number =>
  stack.findIndex(
    (d) =>
      d.parentId === destination.parentId && d.slotKey === destination.slotKey,
  );

/** Wrapping forward step through a stack of length `stackLength`. 0 when empty. */
export const stepCycle = (stackLength: number, current: number): number =>
  stackLength === 0 ? 0 : (current + 1) % stackLength;

/** Wrapping reverse step through a stack of length `stackLength`. 0 when empty. */
export const stepCycleBack = (stackLength: number, current: number): number =>
  stackLength === 0 ? 0 : (current - 1 + stackLength) % stackLength;
