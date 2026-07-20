import { useCallback, useRef } from "react";
import type { ComponentData, Config, Data } from "@puckeditor/core";
import { buildIndex } from "@duckeditor/spec";
import { add } from "../spec-ops/index.js";
import type { EditorEvent } from "../machine/index.js";
import type { EditorCommit } from "../types.js";
import { routeInsert, directTarget } from "./route.js";

type InsertDeps = {
  data: Data;
  config: Config;
  lastSelectedId: string | null;
  pointer: string;
  send: (event: EditorEvent) => void;
  commit: EditorCommit;
};

export type InsertTarget = {
  parentId: string | null;
  slotKey: string | null;
  index?: number;
};

const randomSuffix = (): string => Math.random().toString(36).slice(2, 8);

const mintId = (componentType: string, taken: ReadonlySet<string>): string => {
  const prefix = componentType.toLowerCase();
  let id = `${prefix}-${randomSuffix()}`;
  while (taken.has(id)) id = `${prefix}-${randomSuffix()}`;
  return id;
};

/** The write target for a direct (non-slot-choice) insert. A slot-choice route
 *  must have been resolved to an explicit target upstream (the slot picker), so
 *  reaching here with one is a wiring defect — surface it and write nothing,
 *  never silently append to the root. */
const resolveDirectTarget = (
  data: Data,
  selectedId: string | null,
): InsertTarget | undefined => {
  const route = routeInsert(data, selectedId);
  if (route.kind === "slot-choice") {
    console.error(
      "useInsert: slot-choice route reached the direct insert path without an explicit target",
      route,
    );
    return undefined;
  }
  return directTarget(route);
};

/** The event an insert intent dispatches, routed without a silent slot default:
 *  - in slot-selected a slot is ALREADY chosen — open the picker for it
 *    (OPEN_INSERT). Never re-route: re-choosing the first slot would silently
 *    reset the user's choice. Retargeting a slot is the band click's job (R11).
 *  - a multi-slot node enters the slot-choice step (slot-selected, every band
 *    painted) — the user picks the slot, then opens the picker.
 *  - a single-slot node inserts in ONE action: straight to the picker with its
 *    one slot named on screen (no choice to make).
 *  - anything else opens the direct (sibling/root) picker. */
export const openInsertEvent = (args: {
  data: Data;
  lastSelectedId: string | null;
  pointer: string;
}): EditorEvent => {
  if (args.pointer === "slot-selected") return { type: "OPEN_INSERT" };
  const route = routeInsert(args.data, args.lastSelectedId);
  if (route.kind !== "slot-choice") return { type: "OPEN_INSERT" };
  return route.slotKeys.length === 1
    ? {
        type: "OPEN_INSERT_SLOT",
        parentId: route.parentId,
        slotKey: route.slotKeys[0],
      }
    : {
        type: "SELECT_SLOT",
        parentId: route.parentId,
        slotKey: route.slotKeys[0],
      };
};

export function useInsert(deps: InsertDeps): {
  openInsert: () => void;
  onInsert: (componentType: string, explicitTarget?: InsertTarget) => void;
} {
  const ref = useRef(deps);
  ref.current = deps;

  const openInsert = useCallback(() => {
    const { data, lastSelectedId, pointer, send } = ref.current;
    send(openInsertEvent({ data, lastSelectedId, pointer }));
  }, []);

  const onInsert = useCallback(
    (componentType: string, explicitTarget?: InsertTarget) => {
      const { data, config, lastSelectedId, send, commit } = ref.current;

      const target =
        explicitTarget ?? resolveDirectTarget(data, lastSelectedId);
      if (!target) return;

      const id = mintId(componentType, new Set(buildIndex(data).keys()));
      const component: ComponentData = {
        type: componentType,
        props: { id },
      };

      add(
        data,
        {
          parentId: target.parentId,
          slotKey: target.slotKey,
          component,
          index: target.index,
        },
        config,
      ).map((next) => {
        commit({
          beforeData: data,
          afterData: next,
          label: `Added ${componentType}`,
          resolve: { kind: "insert", id },
        });
        send({ type: "SELECT", elementId: id });
      });
    },
    [],
  );

  return { openInsert, onInsert };
}
