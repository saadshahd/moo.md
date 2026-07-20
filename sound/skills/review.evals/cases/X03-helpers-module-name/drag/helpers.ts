import {
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import type { FiberRegistry } from "../fiber/index.js";
import type { Axis } from "../layout/index.js";

// --- Drag data bag ---

/** Typed shape stored in pragmatic-dnd's untyped userData bag. */
export type DragData = {
  elementId: string;
  parentId: string | null;
  slotKey: string | null;
  index: number;
  role: "sibling" | "container";
};

/** Single boundary cast — all downstream code is type-safe. */
export const readData = (bag: Record<string | symbol, unknown>) =>
  bag as DragData;

/** A slot location: parent element and slot key (both null at root content). */
type SlotLocation = { parentId: string | null; slotKey: string | null };

/** Whether two elements live in the same slot — same parent, same slot key.
 *  The one law for "same slot": guard suppression and drop-index adjustment
 *  must agree, so both read it from here. */
export const sameSlotAs = (a: SlotLocation, b: SlotLocation): boolean =>
  a.parentId === b.parentId && a.slotKey === b.slotKey;

// --- Axis & edges ---

export { resolveSlotAxis } from "../layout/index.js";

export const EDGES: Record<Axis, Edge[]> = {
  vertical: ["top", "bottom"],
  horizontal: ["left", "right"],
};

// --- Drop index ---

/** Resolve a same-slot reorder destination index. */
export const resolveDropIndex = (
  sourceIndex: number,
  target: { data: Record<string | symbol, unknown> },
  axis: Axis,
): number => {
  const { index: targetIndex } = readData(target.data);
  return getReorderDestinationIndex({
    startIndex: sourceIndex,
    indexOfTarget: targetIndex,
    closestEdgeOfTarget: extractClosestEdge(target.data),
    axis,
  });
};

/** Resolve a cross-slot insert index from edge position. */
export const resolveInsertIndex = (
  targetIndex: number,
  edge: Edge | null,
): number =>
  edge === "bottom" || edge === "right" ? targetIndex + 1 : targetIndex;

// --- View transitions ---

export const tagTransitionNames = (reg: FiberRegistry, ids: string[]) => {
  const restores = ids.flatMap((id) => {
    const el = reg.get(id);
    if (!el) return [];
    const prev = el.style.viewTransitionName;
    el.style.viewTransitionName = id;
    return [
      () => {
        el.style.viewTransitionName = prev;
      },
    ];
  });
  return () => restores.forEach((fn) => fn());
};
