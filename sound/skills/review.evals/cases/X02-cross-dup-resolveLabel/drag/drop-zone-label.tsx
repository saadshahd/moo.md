import type { Data } from "@puckeditor/core";
import { findById, findParent } from "@duckeditor/spec";
import type { DropTarget } from "../layout/index.js";

export function resolveContainerId(data: Data, target: DropTarget): string | null {
  if (target.kind === "container") return target.elementId;
  return findParent(data, target.elementId)?.parentId ?? null;
}

export function resolveLabel(data: Data, target: DropTarget): string | null {
  const containerId = resolveContainerId(data, target);
  const type = containerId ? findById(data, containerId)?.type : undefined;
  if (!type) return null;
  return target.kind === "container" ? `${type} \u203a ${target.slotKey}` : type;
}

export function DropZoneLabel({ data, target }: { data: Data; target: DropTarget }) {
  const label = resolveLabel(data, target);
  if (!label) return null;
  return <span className="drop-zone-label">{label}</span>;
}
