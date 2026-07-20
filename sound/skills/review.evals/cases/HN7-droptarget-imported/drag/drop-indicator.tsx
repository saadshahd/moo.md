import { useShadowSheet } from "../overlay/index.js";
import type { FiberRegistry } from "../fiber/index.js";
import type { DropTarget } from "../layout/index.js";
import css from "./drag.css?inline";

type Props = {
  registry: FiberRegistry;
  target: Extract<DropTarget, { kind: "line" } | { kind: "container" }>;
  altHeld?: boolean;
};

type Blockable = { blocked?: boolean };

const INSET = -2;
const EXPAND = 4;

/** Tile rect for the active slot, when the tiling carries one. */
const activeTileRect = (
  target: DropTarget & { kind: "container" },
): DOMRect | undefined =>
  target.tiling.kind === "tiled"
    ? target.tiling.tiles.find((t) => t.slotKey === target.slotKey)?.rect
    : undefined;

function ContainerHighlight({
  registry,
  target,
  altHeld,
}: {
  registry: FiberRegistry;
  target: DropTarget & { kind: "container" } & Blockable;
  altHeld?: boolean;
}) {
  const r =
    activeTileRect(target) ??
    registry.get(target.elementId)?.getBoundingClientRect();
  if (!r) return null;
  return (
    <div
      data-role="drop-indicator-container"
      className="drop-indicator-container"
      data-blocked={target.blocked && !altHeld ? "true" : undefined}
      style={{
        top: r.top + INSET,
        left: r.left + INSET,
        width: r.width + EXPAND,
        height: r.height + EXPAND,
      }}
    >
      <span className="drop-blocked-hint">⌥ place anyway</span>
    </div>
  );
}

function LineIndicator({
  registry,
  target,
  altHeld,
}: {
  registry: FiberRegistry;
  target: DropTarget & { kind: "line" } & Blockable;
  altHeld?: boolean;
}) {
  const el = registry.get(target.elementId);
  if (!el) return null;

  const r = el.getBoundingClientRect();
  const isV = target.axis === "vertical";

  const style = isV
    ? {
        top: target.edge === "top" ? r.top : r.bottom,
        left: r.left,
        width: r.width,
        height: 0,
      }
    : {
        top: r.top,
        left: target.edge === "left" ? r.left : r.right,
        width: 0,
        height: r.height,
      };

  return (
    <div
      data-role="drop-indicator"
      className="drop-indicator-line"
      data-axis={target.axis}
      data-blocked={target.blocked && !altHeld ? "true" : undefined}
      style={style}
    >
      <span className="drop-blocked-hint">⌥ place anyway</span>
    </div>
  );
}

export function DropIndicator({ registry, target, altHeld }: Props) {
  useShadowSheet(css);
  if (target.kind === "container")
    return (
      <ContainerHighlight
        registry={registry}
        target={target}
        altHeld={altHeld}
      />
    );
  return (
    <LineIndicator registry={registry} target={target} altHeld={altHeld} />
  );
}
