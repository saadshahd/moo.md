import { useEffect, useRef, useState } from "react";
import type { Config, Data } from "@puckeditor/core";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { disableNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview";
import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  allowedTypes,
  buildIndex,
  collectDescendants,
  findParent,
  slotKeysOf,
} from "@duckeditor/spec";
import { resolveHit, type FiberRegistry } from "../fiber/index.js";
import type { EditorEvent, EditorSnapshot } from "../machine/index.js";
import type { DropTarget } from "../layout/index.js";
import type { DragData } from "./helpers.js";
import { EDGES, resolveSlotAxis, tagTransitionNames } from "./helpers.js";
import {
  destinationStack,
  Cycle,
  sameStatus,
  type CycleState,
  type CycleStatus,
} from "../layout/index.js";
import { animatedUpdate } from "../animated-update.js";
import type { EditorCommit } from "../types.js";
import { resolveIndicator } from "./resolve-indicator.js";
import { resolveDrop } from "./resolve-drop.js";

// --- Helpers ---

/** Module-level flag: once the designer completes one successful carry move,
 *  the cross-slot hint becomes unnecessary and never appears again. */
let carrySeenRef = false;

type Props = {
  registry: FiberRegistry | null;
  data: Data;
  index: ReturnType<typeof buildIndex>;
  state: EditorSnapshot;
  send: (event: EditorEvent) => void;
  commit: EditorCommit;
  config: Config;
};

const stateOf = (s: EditorSnapshot) =>
  s.value as { pointer: string; drag: string };

type Point = { x: number; y: number };

/** Whether the release point still lands inside the held indicator's drop region.
 *
 *  pragmatic clears `dropTargets` before `drop` in two distinct gestures that
 *  both leave a preserved indicator:
 *   - transient window-leave (`dragleave` relatedTarget=null) while the pointer
 *     never left the slot — the release is still over the indicator (commit), and
 *   - a genuine move out to empty space, then release in the void (cancel).
 *  A point hit-test separates them: in the void no registered element resolves;
 *  over the slot the indicator's container (or a descendant) does. Container
 *  drops must land inside the container; line/root drops beside the anchor's
 *  container. */
const dropOverIndicator = (
  registry: FiberRegistry,
  data: Data,
  indicator: DropTarget,
  point: Point,
): boolean => {
  const hit = resolveHit(registry, point.x, point.y);
  if (!hit) return false;
  if (indicator.kind === "root") return true;
  const { elementId } = indicator;
  if (hit.elementId === elementId) return true;
  if (collectDescendants(data, elementId).includes(hit.elementId)) return true;
  return findParent(data, elementId)?.parentId === hit.elementId;
};

// --- Hook ---

export function useDragReorder({
  registry,
  data,
  index,
  state,
  send,
  commit,
  config,
}: Props): {
  dropTarget: DropTarget | null;
  cycleStatus: CycleStatus | null;
  sourceType: string | null;
  point: Point | null;
  crossSlotHint: boolean;
  cancelFlash: Point | null;
  altHeld: boolean;
} {
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const [cycleStatus, setCycleStatus] = useState<CycleStatus | null>(null);
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [crossSlotHint, setCrossSlotHint] = useState(false);
  const [cancelFlash, setCancelFlash] = useState<Point | null>(null);
  const [altHeld, setAltHeld] = useState(false);
  const cancelFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether pragmatic's monitor onDrop fired for the current drag.
  const monitorDropFiredRef = useRef(false);

  const updateDropTarget = (target: DropTarget | null) => {
    dropTargetRef.current = target;
    setDropTarget(target);
  };

  const showCrossSlotHint = () => {
    if (carrySeenRef) return;
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setCrossSlotHint(true);
    hintTimerRef.current = setTimeout(() => {
      setCrossSlotHint(false);
      hintTimerRef.current = null;
    }, 3000);
  };

  const dismissHint = () => {
    if (!hintTimerRef.current) return;
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = null;
    setCrossSlotHint(false);
  };
  const dataRef = useRef(data);
  dataRef.current = data;
  const indexRef = useRef(index);
  indexRef.current = index;
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const configRef = useRef(config);
  configRef.current = config;
  const sourceTypeRef = useRef<string | null>(null);

  // Transient drag state — refs, never deps, so handlers stay attached mid-drag.
  const cycleRef = useRef<CycleState>(Cycle.idle);
  const prevShiftRef = useRef(false);

  const { lastSelectedId, selectedIds } = state.context;
  const pointer = stateOf(state).pointer;
  const singleSelected = selectedIds.size === 1;

  // --- Effect 1: Make selected element draggable (single selection only) ---

  useEffect(() => {
    if (
      !registry ||
      !lastSelectedId ||
      !singleSelected ||
      pointer !== "selected"
    )
      return;

    const parent = findParent(dataRef.current, lastSelectedId);
    if (!parent) return;

    const sourceEl = registry.get(lastSelectedId);
    if (!sourceEl) return;

    let clearNames: (() => void) | null = null;

    return draggable({
      element: sourceEl,
      getInitialData: (): DragData => ({
        elementId: lastSelectedId,
        parentId: parent.parentId,
        slotKey: parent.slotKey,
        index: parent.index,
        role: "sibling",
      }),
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        const allIds = [...indexRef.current.keys()];
        clearNames = tagTransitionNames(registry, allIds);
        // No native preview snapshot — a static image cannot live-update the
        // resolved destination. The overlay MoveGhost follows the pointer and
        // re-resolves instead.
        disableNativeDragPreview({ nativeSetDragImage });
      },
      onDragStart: () => {
        setSourceType(
          indexRef.current.get(lastSelectedId)?.component.type ?? null,
        );
        send({ type: "DRAG_START", sourceId: lastSelectedId });
      },
      onDrop: () => {
        clearNames?.();
        clearNames = null;
        setSourceType(null);
        setPoint(null);
        setAltHeld(false);
        // If the monitor's onDrop never fired, the drag ended without pragmatic
        // processing a drop — the classic cross-shadow-DOM slot boundary fail.
        if (!monitorDropFiredRef.current) showCrossSlotHint();
        monitorDropFiredRef.current = false;
      },
    });
  }, [registry, lastSelectedId, singleSelected, pointer, send]);

  // --- Effect 2: Register drop targets on every component ---

  useEffect(() => {
    if (!registry) return;

    const cleanups: (() => void)[] = [];

    for (const [id, { component, path }] of index) {
      const el = registry.get(id);
      const parent = path.at(-1);
      if (!el || !parent) continue;

      const slots = slotKeysOf(component);
      const isContainer = slots.length > 0;
      const edges =
        EDGES[
          resolveSlotAxis(
            dataRef.current,
            parent.parentId,
            parent.slotKey,
            registry,
          ) ?? "vertical"
        ];

      cleanups.push(
        dropTargetForElements({
          element: el,
          canDrop: ({ source }) => (source.data.elementId as string) !== id,
          getData: ({ input, element }) => {
            if (isContainer)
              return {
                elementId: id,
                parentId: parent.parentId,
                slotKey: parent.slotKey,
                index: parent.index,
                role: "container",
              } satisfies DragData;
            return attachClosestEdge(
              {
                elementId: id,
                parentId: parent.parentId,
                slotKey: parent.slotKey,
                index: parent.index,
                role: "sibling",
              } satisfies DragData,
              { element, input, allowedEdges: edges },
            );
          },
        }),
      );
    }

    return () => cleanups.forEach((fn) => fn());
  }, [registry, data, index]);

  // --- Effect 3: Global drop monitor ---

  useEffect(() => {
    if (!registry) return;

    let descendants: ReadonlySet<string> = new Set();
    let detachShift: (() => void) | null = null;

    type Source = { data: Record<string | symbol, unknown> };
    type Location = {
      current: {
        dropTargets: readonly { data: Record<string | symbol, unknown> }[];
        input: {
          clientX: number;
          clientY: number;
          shiftKey: boolean;
          altKey: boolean;
        };
      };
    };

    // Stack of reachable destinations under the pointer, excluding the dragged
    // subtree. The rising shift edge steps the cycle over it; pointer drift
    // within the same deepest container holds, a new container resets.
    const driveCycle = (
      source: Source,
      point: { x: number; y: number },
      shiftKey: boolean,
    ) => {
      const stack = destinationStack({
        point,
        data: dataRef.current,
        registry,
        excludeId: source.data.elementId as string,
      });
      if (shiftKey && !prevShiftRef.current)
        cycleRef.current = Cycle.step(cycleRef.current, stack);
      prevShiftRef.current = shiftKey;
      cycleRef.current = Cycle.syncPointer(cycleRef.current, stack);
      const picked = Cycle.selected(cycleRef.current, stack);

      // Update cycle counter UI state. This runs per pointer move; the
      // functional updater returns the previous reference when unchanged so
      // React bails out of the re-render.
      const next = Cycle.status(cycleRef.current, stack.length, "drag");
      setCycleStatus((prev) => (sameStatus(prev, next) ? prev : next));

      return picked;
    };

    const withBlocked = (
      target: DropTarget,
      sType: string | null,
    ): DropTarget => {
      if (!sType || !configRef.current) return target;
      if (target.kind === "container") {
        const parentType = indexRef.current.get(target.elementId)?.component
          .type;
        if (!parentType) return target;
        const blocked = !allowedTypes(
          configRef.current,
          parentType,
          target.slotKey,
        ).has(sType);
        return blocked ? { ...target, blocked } : target;
      }
      return target;
    };

    // Pragmatic path: cycle override wins, else pointer resolution.
    const updateFromLocation = (source: Source, location: Location) => {
      const point = {
        x: location.current.input.clientX,
        y: location.current.input.clientY,
      };
      setPoint(point);
      const picked = driveCycle(source, point, location.current.input.shiftKey);
      if (picked)
        return updateDropTarget(
          withBlocked(
            Cycle.toTarget(picked, dataRef.current, registry),
            sourceTypeRef.current,
          ),
        );
      updateDropTarget(
        resolveIndicator({
          source,
          target: location.current.dropTargets[0],
          point,
          previous: dropTargetRef.current,
          data: dataRef.current,
          registry,
          descendantSet: descendants,
          config: configRef.current,
          sourceType: sourceTypeRef.current,
        }),
      );
    };

    const stopMonitor = monitorForElements({
      onDragStart: ({ source }) => {
        descendants = new Set(
          collectDescendants(dataRef.current, source.data.elementId as string),
        );
        sourceTypeRef.current =
          indexRef.current.get(source.data.elementId as string)?.component
            .type ?? null;
        cycleRef.current = Cycle.idle;
        prevShiftRef.current = false;
        // Entry disclosure: the chip shows "⇧ to cycle" from the first frame,
        // before any step. driveCycle flips it to "N of M" once stepping starts.
        setCycleStatus({ phase: "entry", modality: "drag" });
        // Native fallback: spec dragover fires on modifier-only changes that
        // pragmatic may swallow when coordinates don't move (~350ms cadence).
        // It only drives the cycle — pointer resolution stays with pragmatic.
        const onDragOver = (e: DragEvent) => {
          const picked = driveCycle(
            source,
            { x: e.clientX, y: e.clientY },
            e.shiftKey,
          );
          if (picked)
            updateDropTarget(
              withBlocked(
                Cycle.toTarget(picked, dataRef.current, registry),
                sourceTypeRef.current,
              ),
            );
        };
        document.addEventListener("dragover", onDragOver);
        detachShift = () =>
          document.removeEventListener("dragover", onDragOver);
      },
      onDrag: ({ source, location }) => {
        setAltHeld(location.current.input.altKey);
        updateFromLocation(source, location);
      },
      onDropTargetChange: ({ source, location }) => {
        // Pragmatic fires onDropTargetChange with an empty dropTargets array
        // just before onDrop on the actual release. If we're currently showing
        // a blocked indicator, updating state here would flash "No target here"
        // for one frame before onDrop fires. Hold the blocked indicator — onDrop
        // clears it correctly whether the drop cancels or commits.
        const isAboutToDrop = location.current.dropTargets.length === 0;
        const currentIsBlocked =
          dropTargetRef.current !== null &&
          (dropTargetRef.current.kind === "container" ||
            dropTargetRef.current.kind === "line") &&
          dropTargetRef.current.blocked;
        if (isAboutToDrop && currentIsBlocked) return;
        updateFromLocation(source, location);
      },
      onDrop: ({ source, location }) => {
        monitorDropFiredRef.current = true;
        detachShift?.();
        detachShift = null;
        cycleRef.current = Cycle.idle;
        prevShiftRef.current = false;
        setCycleStatus(null);
        setAltHeld(false);
        setSourceType(null);
        sourceTypeRef.current = null;
        setPoint(null);
        const lastIndicator = dropTargetRef.current;
        const altKey = location.current.input.altKey;
        const releasePoint = {
          x: location.current.input.clientX,
          y: location.current.input.clientY,
        };
        const target = location.current.dropTargets[0];
        updateDropTarget(null);
        const beforeData = dataRef.current;
        // pragmatic clears `dropTargets` before `drop` on a transient
        // window-leave too — fall back to the preserved indicator, but only when
        // the release still lands over it, so a move-out-then-drop-in-void cancels.
        const indicatorReleasedInVoid =
          !target &&
          !!lastIndicator &&
          !dropOverIndicator(registry, beforeData, lastIndicator, releasePoint);
        const indicator = indicatorReleasedInVoid ? null : lastIndicator;
        // Blocked target without Alt → cancel without committing.
        const isBlockedDrop =
          indicator &&
          (indicator.kind === "container" || indicator.kind === "line") &&
          indicator.blocked &&
          !altKey;
        const result = isBlockedDrop
          ? null
          : resolveDrop({
              source,
              target,
              indicator,
              data: beforeData,
              descendantSet: descendants,
            });
        descendants = new Set();
        if (!result) {
          // Flash the cancel confirmation at the release point, then clear.
          if (cancelFlashTimerRef.current)
            clearTimeout(cancelFlashTimerRef.current);
          setCancelFlash(releasePoint);
          cancelFlashTimerRef.current = setTimeout(() => {
            setCancelFlash(null);
            cancelFlashTimerRef.current = null;
          }, 700);
          return send({ type: "DRAG_CANCEL" });
        }
        result.newData.map((d) => {
          // Successful cross-slot move: designer knows the carry gesture — hide
          // the hint forever (module-level flag survives re-renders, not remounts).
          carrySeenRef = true;
          animatedUpdate((next) => {
            commitRef.current({
              beforeData,
              afterData: next,
              label: "Reordered element",
              resolve: { kind: "move", id: source.data.elementId as string },
            });
          }, d);
        });
        send(result.event);
      },
    });

    return () => {
      detachShift?.();
      stopMonitor();
    };
  }, [registry, data, send]);

  // --- Effect 4: Dismiss cross-slot hint on next user action ---

  useEffect(() => {
    if (!crossSlotHint) return;
    const handler = () => dismissHint();
    document.addEventListener("click", handler, { capture: true });
    document.addEventListener("keydown", handler, { capture: true });
    return () => {
      document.removeEventListener("click", handler, { capture: true });
      document.removeEventListener("keydown", handler, { capture: true });
    };
  }, [crossSlotHint]);

  // --- Cleanup timers on unmount ---

  useEffect(
    () => () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (cancelFlashTimerRef.current)
        clearTimeout(cancelFlashTimerRef.current);
    },
    [],
  );

  return {
    dropTarget,
    cycleStatus,
    sourceType,
    point,
    crossSlotHint,
    cancelFlash,
    altHeld,
  };
}
