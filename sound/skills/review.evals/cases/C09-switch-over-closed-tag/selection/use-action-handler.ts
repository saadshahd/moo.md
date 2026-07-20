import { useCallback } from "react";
import type { Data } from "@puckeditor/core";
import {
  collectDescendants,
  findById,
  findParent,
  nearestSibling,
} from "@duckeditor/spec";
import type { EditorEvent, EditorSnapshot } from "../machine/index.js";
import type { Axis } from "../layout/index.js";
import { move, removeMany } from "../spec-ops/index.js";
import { animatedUpdate } from "../animated-update.js";
import type { EditorCommit } from "../types.js";
import type { EditorAction } from "./action-bar.js";

const MOVE_LABELS: Record<Axis, { prev: string; next: string }> = {
  vertical: { prev: "up", next: "down" },
  horizontal: { prev: "left", next: "right" },
};

export function useActionHandler({
  data,
  state,
  send,
  commit,
  axis,
}: {
  data: Data;
  state: EditorSnapshot;
  send: (event: EditorEvent) => void;
  commit: EditorCommit;
  axis: Axis;
}): (action: EditorAction) => void {
  return useCallback(
    (action: EditorAction) => {
      const { selectedIds, lastSelectedId } = state.context;
      if (selectedIds.size === 0 || !lastSelectedId) return;

      const type = findById(data, lastSelectedId)?.type ?? "element";
      const labels = MOVE_LABELS[axis];

      switch (action.tag) {
        case "edit":
          send({ type: "OPEN_SHEET" });
          break;
        case "move-up":
        case "move-down": {
          if (selectedIds.size > 1) return;
          const parent = findParent(data, lastSelectedId);
          if (!parent) return;
          const direction = action.tag === "move-up" ? -1 : 1;
          const label = action.tag === "move-up" ? labels.prev : labels.next;
          move(
            data,
            lastSelectedId,
            parent.parentId,
            parent.slotKey,
            parent.index + direction,
          ).map((next) => {
            animatedUpdate((d) => {
              commit({
                beforeData: data,
                afterData: d,
                label: `Moved ${type} ${label}`,
                group: `move:${lastSelectedId}`,
                resolve: { kind: "move", id: lastSelectedId },
              });
            }, next);
          });
          break;
        }
        case "delete": {
          const ids = [...selectedIds];
          const removedIds = [
            ...new Set(
              ids.flatMap((id) => [id, ...collectDescendants(data, id)]),
            ),
          ];
          const label =
            ids.length > 1
              ? `Deleted ${ids.length} elements`
              : `Deleted ${type}`;
          const parentBefore = findParent(data, lastSelectedId);
          removeMany(data, ids).map((next) => {
            commit({
              beforeData: data,
              afterData: next,
              label,
              resolve: { kind: "remove", ids: removedIds },
            });
            if (ids.length > 1) {
              send({ type: "DESELECT" });
            } else {
              const target = nearestSibling(
                data,
                parentBefore?.parentId ?? null,
                parentBefore?.slotKey ?? null,
                lastSelectedId,
              );
              target
                ? send({ type: "SELECT", elementId: target })
                : send({ type: "DESELECT" });
            }
          });
          break;
        }
      }
    },
    [
      data,
      state.context.selectedIds,
      state.context.lastSelectedId,
      commit,
      send,
      axis,
    ],
  );
}
