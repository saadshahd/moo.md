import { useFloating, offset, shift, autoUpdate } from "@floating-ui/react";
import { useShadowSheet, useRegistryAnchor } from "../overlay/index.js";
import type { FiberRegistry } from "../fiber/index.js";
import { NO_TARGET_LABEL } from "../layout/index.js";
import css from "./drag.css?inline";

type Props = { registry: FiberRegistry; elementId: string };

/** Explicit marker for a pointer inside a container that offers no valid drop —
 *  every pointer position yields exactly one named outcome. */
export function NoTargetMarker({ registry, elementId }: Props) {
  useShadowSheet(css);

  const { refs, floatingStyles } = useFloating({
    placement: "top-start",
    middleware: [offset(4), shift({ padding: 8 })],
    whileElementsMounted: (ref, floating, update) =>
      autoUpdate(ref, floating, update, { animationFrame: true }),
  });

  useRegistryAnchor(refs, registry, elementId);

  return (
    <div
      ref={refs.setFloating}
      data-role="no-target-marker"
      className="no-target-marker"
      style={{ ...floatingStyles, zIndex: 1 }}
    >
      {NO_TARGET_LABEL}
    </div>
  );
}
