import { useShadowSheet } from "../overlay/index.js";
import { NO_TARGET_LABEL } from "../layout/index.js";
import css from "./carry.css?inline";

type Point = { x: number; y: number };

/** Transient "no target here" marker flashed at the pointer when a carry click
 *  lands on a dead zone — momentary confirmation that the click was rejected. The
 *  continuous blocked state is named by the MoveGhost; this is only the rejection
 *  pulse, queried independently by its data-role. */
export function NoTargetMarker({ point }: { point: Point }) {
  useShadowSheet(css);

  return (
    <div
      data-role="carry-no-target-flash"
      className="carry-no-target-flash"
      style={{
        position: "absolute",
        top: point.y + 8,
        left: point.x + 8,
        zIndex: 1,
      }}
    >
      {NO_TARGET_LABEL}
    </div>
  );
}
