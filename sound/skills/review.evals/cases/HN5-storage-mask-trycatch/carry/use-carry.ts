import { useEffect, useRef, useState } from "react";
import type { Config, Data } from "@puckeditor/core";
import { allowedTypes, findById, findParent } from "@duckeditor/spec";
import type { FiberRegistry } from "../fiber/index.js";
import type { EditorEvent, EditorSnapshot } from "../machine/index.js";
import {
  destinationStack,
  aimDestination,
  stackIndexOf,
  Cycle,
  sameStatus,
  type CycleState,
  type CycleStatus,
  type Destination,
  type DropTarget,
} from "../layout/index.js";
import { animatedUpdate } from "../animated-update.js";
import { move } from "../spec-ops/index.js";
import type { EditorCommit } from "../types.js";
import { useScrollResolve } from "./use-scroll-resolve.js";

type Props = {
  registry: FiberRegistry | null;
  data: Data;
  config: Config | undefined;
  state: EditorSnapshot;
  send: (event: EditorEvent) => void;
  commit: EditorCommit;
};

type Point = { x: number; y: number };

const stateOf = (s: EditorSnapshot) => s.value as { drag: string };

/** Pointer-driven move: while the FSM is `carrying`, the pointer position (and
 *  arrow/Shift steps) select one destination from the stack under it. Click on a
 *  valid destination commits the `move`; Esc cancels. Same resolver, tiles, and
 *  `move` op as drag — only the input is plain pointer events, not a native drag. */
const CARRY_SEEN_KEY = "duck:carry-seen";

const readCarrySeen = (): boolean => {
  try {
    return !!localStorage.getItem(CARRY_SEEN_KEY);
  } catch {
    return true; // Restricted environment — never show.
  }
};

const markCarrySeen = () => {
  try {
    localStorage.setItem(CARRY_SEEN_KEY, "1");
  } catch {
    // Restricted environment — silently skip.
  }
};

export function useCarry({
  registry,
  data,
  config,
  state,
  send,
  commit,
}: Props): {
  target: DropTarget | null;
  noTargetFlash: Point | null;
  cancelFlash: Point | null;
  cycleStatus: CycleStatus | null;
  liftRect: DOMRect | null;
  sourceType: string | null;
  point: Point | null;
  carryCoachMark: boolean;
  stepLabel: string | null;
  altHeld: boolean;
} {
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [noTargetFlash, setNoTargetFlash] = useState<Point | null>(null);
  const [cancelFlash, setCancelFlash] = useState<Point | null>(null);
  const [cycleStatus, setCycleStatus] = useState<CycleStatus | null>(null);
  const [liftRect, setLiftRect] = useState<DOMRect | null>(null);
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [carryCoachMark, setCarryCoachMark] = useState(false);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [altHeld, setAltHeld] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // The latest carry resolution closure — the same path pointermove runs. The
  // scroll subscription calls it so a scroll re-aims every affordance (tiles,
  // labels, lift pulse) against the geometry now under the viewport pointer.
  const resolveRef = useRef<(() => void) | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const configRef = useRef(config);
  configRef.current = config;
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const { drag } = stateOf(state);
  const sourceId = state.context.dragSourceId;
  const carrying = drag === "carrying";

  useEffect(() => {
    if (!registry || !carrying || !sourceId) return;

    setSourceType(findById(dataRef.current, sourceId)?.type ?? null);

    // Cursor lives on body for the duration of carry (body is outside the shadow
    // root). `render` keeps it honest: "move" over a real destination,
    // "not-allowed" over a dead zone — the cursor never lies about reachability.
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "move";

    let raf = 0;
    // Seed from the carried element's center so a stationary lift (Space, toolbar
    // Move) resolves a destination immediately — before any pointer move.
    const sourceRect = registry.get(sourceId)?.getBoundingClientRect();
    let point = sourceRect
      ? {
          x: sourceRect.x + sourceRect.width / 2,
          y: sourceRect.y + sourceRect.height / 2,
        }
      : { x: 0, y: 0 };
    let cycle: CycleState = Cycle.idle;
    let selected: Destination | null = null;
    // The gesture that entered carry (toolbar click / Space) is still settling
    // when these listeners attach. Arm on the next tick so that entering event
    // cannot reach commit; genuinely later clicks/keys do.
    let armed = false;
    const armTimer = setTimeout(() => {
      armed = true;
    }, 0);

    // One-time coach mark: show only if this is the first ever carry.
    const showCoachMark = !readCarrySeen();
    if (showCoachMark) setCarryCoachMark(true);

    const dismissCoachMark = () => {
      if (!showCoachMark) return;
      setCarryCoachMark(false);
      markCarrySeen();
    };

    const stackAt = () =>
      destinationStack({
        point,
        data: dataRef.current,
        registry,
        excludeId: sourceId,
      });

    // The slot the pointer aims at — same tile hit-test as drag. Falls back to
    // the stack head over discrete containers, root content, and band gaps.
    const aimAt = () =>
      aimDestination({
        point,
        data: dataRef.current,
        registry,
        excludeId: sourceId,
      });

    /** Mirror of use-drag-reorder's `withBlocked`: stamps `blocked: true` on a
     *  container target when the source type is not in `allowedTypes`. Root and
     *  none targets are never blocked — they have no slot constraint. */
    const withBlocked = (target: DropTarget): DropTarget => {
      const cfg = configRef.current;
      const sType = findById(dataRef.current, sourceId)?.type;
      if (!cfg || !sType || target.kind !== "container") return target;
      const parentType = findById(dataRef.current, target.elementId)?.type;
      if (!parentType) return target;
      const blocked = !allowedTypes(cfg, parentType, target.slotKey).has(sType);
      return blocked ? { ...target, blocked } : target;
    };

    // Cycle override wins; otherwise the pointer-aimed slot. Mirrors drag's
    // `updateFromLocation`: stepping overrides pointer, pointer reclaims on move.
    const render = (stack: readonly Destination[], fromStep = false) => {
      const picked = Cycle.selected(cycle, stack) ?? aimAt();
      selected = picked ?? null;
      setTarget(
        picked
          ? withBlocked(Cycle.toTarget(picked, dataRef.current, registry))
          : null,
      );
      // The move ghost rides the live pointer; a null target paints its blocked
      // state. The cursor follows suit: "move" over a destination, "not-allowed"
      // over a dead zone — it never lies about reachability.
      setPoint({ ...point });
      document.body.style.cursor = picked ? "move" : "not-allowed";
      // Cycle chip: "⇥ to cycle" from carry entry, "N of M" once a cycle is
      // active — the chip is present for the whole carry, never just after Tab.
      const next = Cycle.status(cycle, stack.length, "carry");
      setCycleStatus((prev) => (sameStatus(prev, next) ? prev : next));
      // Lift pulse rides the source's live viewport rect so a scroll re-resolves
      // it in lockstep with the tiles — never a frozen pulse over stale geometry.
      setLiftRect(registry.get(sourceId)?.getBoundingClientRect() ?? null);
      // Destination label: show on discrete step (arrow/Tab); clear on pointer
      // reclaim so the label never persists after the user resumes pointer movement.
      if (fromStep) {
        setStepLabel(picked?.label ?? null);
      } else {
        setStepLabel(null);
      }
    };

    resolveRef.current = () => {
      cycle = Cycle.reclaim(cycle);
      render(stackAt(), false);
    };

    const onPointerMove = (e: PointerEvent) => {
      point = { x: e.clientX, y: e.clientY };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => resolveRef.current?.());
    };

    /** Anchor index from the hovered tile: the stack position the pointer aims
     *  at, so a fresh cycle starts from the current slot rather than slot 0. */
    const anchorFrom = (stack: readonly Destination[]): number => {
      const aimed = aimAt();
      return aimed ? Math.max(0, stackIndexOf(stack, aimed)) : 0;
    };

    /** Step forward through the destination cycle. Tab or any arrow key. */
    const stepForward = () => {
      const stack = stackAt();
      cycle = Cycle.step(cycle, stack, anchorFrom(stack));
      render(stack, true);
    };

    /** Reverse step using (i−1+N)%N. Shift+Tab. */
    const stepReverse = () => {
      const stack = stackAt();
      cycle = Cycle.stepBack(cycle, stack, anchorFrom(stack));
      render(stack, true);
    };

    const flash = (p: Point) => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setNoTargetFlash(p);
      flashTimerRef.current = setTimeout(() => {
        setNoTargetFlash(null);
        flashTimerRef.current = null;
      }, 300);
    };

    const commitMove = (altKey: boolean) => {
      if (!selected) {
        flash(point);
        return;
      }
      const dest = selected;
      const beforeData = dataRef.current;
      if (!findParent(beforeData, sourceId)) {
        flash(point);
        return;
      }
      // Blocked slot without Alt → cancel without committing, same as regular drag.
      const activeTarget = withBlocked(
        Cycle.toTarget(dest, beforeData, registry),
      );
      if (
        activeTarget.kind === "container" &&
        activeTarget.blocked &&
        !altKey
      ) {
        setTarget(null);
        setStepLabel(null);
        // Show the same cancel flash as a blocked regular drag drop.
        if (cancelFlashTimerRef.current)
          clearTimeout(cancelFlashTimerRef.current);
        setCancelFlash({ ...point });
        cancelFlashTimerRef.current = setTimeout(() => {
          setCancelFlash(null);
          cancelFlashTimerRef.current = null;
        }, 700);
        return send({ type: "CARRY_CANCEL" });
      }
      dismissCoachMark();
      setTarget(null);
      move(beforeData, sourceId, dest.parentId, dest.slotKey, dest.index).map(
        (next) => {
          animatedUpdate((d) => {
            commitRef.current({
              beforeData,
              afterData: d,
              label: "Moved element",
              resolve: { kind: "move", id: sourceId },
            });
          }, next);
        },
      );
      send({ type: "CARRY_COMMIT" });
    };

    const onClick = (e: MouseEvent) => {
      if (!armed) return; // The entering click — ignore it.
      e.preventDefault();
      e.stopPropagation();
      dismissCoachMark();
      commitMove(e.altKey);
    };

    // Capture-phase: carry owns these keys while active and stops them before
    // the window-level keyboard machine sees them — so Escape cancels the move
    // without also deselecting, and Space/Enter never double-fire.
    // Tab steps forward and calls preventDefault so focus never leaves the overlay.
    // Shift+Tab steps reverse using (i−1+N)%N. Arrows step forward.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismissCoachMark();
        setTarget(null);
        setStepLabel(null);
        return send({ type: "CARRY_CANCEL" });
      }
      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        return e.shiftKey ? stepReverse() : stepForward();
      }
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
        e.stopPropagation();
        return stepForward();
      }
      if (e.key === "Enter" || e.key === " ") {
        if (!armed) return; // The Space that entered carry — ignore it.
        e.preventDefault();
        e.stopPropagation();
        commitMove(e.altKey);
      }
    };

    const onAltDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltHeld(true);
    };
    const onAltUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltHeld(false);
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("keydown", onAltDown);
    document.addEventListener("keyup", onAltUp);

    render(stackAt());

    return () => {
      clearTimeout(armTimer);
      cancelAnimationFrame(raf);
      resolveRef.current = null;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      document.removeEventListener("keydown", onAltDown);
      document.removeEventListener("keyup", onAltUp);
      setAltHeld(false);
      document.body.style.cursor = prevCursor;
      setTarget(null);
      setSourceType(null);
      setPoint(null);
      setCycleStatus(null);
      setLiftRect(null);
      setStepLabel(null);
      // Dismiss coach mark on any carry exit (commit, cancel, or unexpected).
      if (showCoachMark) {
        setCarryCoachMark(false);
        markCarrySeen();
      }
      // Clear any pending flash timers on carry exit.
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
        setNoTargetFlash(null);
      }
      // cancelFlash timer outlives carry so the "× Cancelled" remains visible
      // after CARRY_CANCEL — do NOT clear it here.
    };
  }, [registry, carrying, sourceId, send]);

  useScrollResolve({ active: carrying, resolve: resolveRef });

  return {
    target,
    noTargetFlash,
    cancelFlash,
    cycleStatus,
    liftRect,
    sourceType,
    point,
    carryCoachMark,
    stepLabel,
    altHeld,
  };
}
