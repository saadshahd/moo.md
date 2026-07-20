import { setup, assign, type SnapshotFrom } from "xstate";
import { Selection } from "./selection-model.js";

// --- Context ---

type InlineEditBase = {
  elementId: string;
  mode: "inline";
  propKey: string;
  original: string;
};

export type InlineEditing = InlineEditBase &
  ({ trigger: "select" } | { trigger: "replace"; char: string });

type SheetEditing = {
  elementId: string;
  mode: "sheet";
};

type Editing = InlineEditing | SheetEditing;

export type SelectedSlot = { parentId: string; slotKey: string };

export type EditorContext = {
  hoveredId: string | null;
  selectedIds: ReadonlySet<string>;
  lastSelectedId: string | null;
  editing: Editing | null;
  dragSourceId: string | null;
  selectedSlot: SelectedSlot | null;
  /** Whether `selectedSlot` was chosen by the user (the slot-choice step) vs
   *  auto-named for a single-slot one-action insert. Decides where Escape from
   *  `inserting` returns: to the slot-choice step only if the user entered it. */
  slotExplicit: boolean;
};

// --- Events ---

export type EditorEvent =
  | { type: "HOVER"; elementId: string }
  | { type: "UNHOVER" }
  | { type: "SELECT"; elementId: string }
  | { type: "REPLACE_SELECT"; elementIds: string[] }
  | { type: "TOGGLE_SELECT"; elementId: string }
  | { type: "DESELECT" }
  | { type: "SELECT_SLOT"; parentId: string; slotKey: string }
  | { type: "OPEN_INSERT_SLOT"; parentId: string; slotKey: string }
  | { type: "OPEN_SHEET" }
  | ({
      type: "START_INLINE_EDIT";
      elementId: string;
      propKey: string;
      original: string;
    } & ({ trigger: "select" } | { trigger: "replace"; char: string }))
  | { type: "COMMIT_EDIT"; newValue: unknown }
  | { type: "CANCEL_EDIT" }
  | { type: "DRAG_START"; sourceId: string }
  | {
      type: "DROP";
      sourceParentId: string | null;
      targetParentId: string | null;
      fromIndex: number;
      toIndex: number;
    }
  | { type: "DRAG_CANCEL" }
  | { type: "CARRY_START"; sourceId: string }
  | { type: "CARRY_COMMIT" }
  | { type: "CARRY_CANCEL" }
  | { type: "OPEN_INSERT" }
  | { type: "ESCAPE" };

// --- Context predicates ---

const isEditing = (ctx: EditorContext) => ctx.editing !== null;
const isDragging = (ctx: EditorContext) => ctx.dragSourceId !== null;

// --- Machine ---

export const editorMachine = setup({
  types: {
    context: {} as EditorContext,
    events: {} as EditorEvent,
  },
  guards: {
    isDifferentHover: ({ context, event }) =>
      event.type === "HOVER" && context.hoveredId !== event.elementId,
    notEditing: ({ context }) => !isEditing(context),
    notDragging: ({ context }) => !isDragging(context),
    multiSelectEmptiesSet: ({ context, event }) =>
      event.type === "TOGGLE_SELECT" &&
      Selection.wouldEmpty(context, event.elementId),
    replaceSelectEmpty: ({ event }) =>
      event.type === "REPLACE_SELECT" && event.elementIds.length === 0,
    hasSlot: ({ context }) => context.selectedSlot !== null,
    slotChosenExplicitly: ({ context }) =>
      context.selectedSlot !== null && context.slotExplicit,
    editingSheet: ({ context }) => context.editing?.mode === "sheet",
  },
}).createMachine({
  id: "editor",
  type: "parallel",
  context: {
    hoveredId: null,
    selectedIds: new Set<string>(),
    lastSelectedId: null,
    editing: null,
    dragSourceId: null,
    selectedSlot: null,
    slotExplicit: false,
  },
  states: {
    pointer: {
      initial: "idle",
      on: {
        DESELECT: {
          target: ".idle",
          actions: assign(() => ({
            ...Selection.clear(),
            hoveredId: null,
            editing: null,
            selectedSlot: null,
          })),
        },
        REPLACE_SELECT: [
          {
            guard: "replaceSelectEmpty",
            target: ".idle",
            actions: assign(() => ({
              ...Selection.clear(),
              hoveredId: null,
              editing: null,
              selectedSlot: null,
            })),
          },
          {
            target: ".selected",
            actions: assign(({ event }) => ({
              ...Selection.ofSet(
                (event as { elementIds: string[] }).elementIds,
              ),
              editing: null,
              selectedSlot: null,
            })),
          },
        ],
      },
      states: {
        idle: {
          on: {
            HOVER: {
              target: "hovering",
              actions: assign({ hoveredId: ({ event }) => event.elementId }),
            },
            SELECT: {
              target: "selected",
              actions: assign(({ event }) => Selection.of(event.elementId)),
            },
            TOGGLE_SELECT: {
              target: "selected",
              actions: assign(({ event }) => Selection.of(event.elementId)),
            },
            REPLACE_SELECT: {
              target: "selected",
              actions: assign(({ event }) => Selection.ofSet(event.elementIds)),
            },
          },
        },
        hovering: {
          on: {
            HOVER: {
              guard: "isDifferentHover",
              actions: assign({ hoveredId: ({ event }) => event.elementId }),
            },
            UNHOVER: {
              target: "idle",
              actions: assign({ hoveredId: null }),
            },
            SELECT: {
              target: "selected",
              actions: assign(({ event }) => ({
                ...Selection.of(event.elementId),
                hoveredId: null,
              })),
            },
            TOGGLE_SELECT: {
              target: "selected",
              actions: assign(({ event }) => ({
                ...Selection.of(event.elementId),
                hoveredId: null,
              })),
            },
            REPLACE_SELECT: {
              target: "selected",
              actions: assign(({ event }) => ({
                ...Selection.ofSet(event.elementIds),
                hoveredId: null,
              })),
            },
          },
        },
        selected: {
          on: {
            DRAG_START: {
              guard: "notEditing",
              target: "dragging",
            },
            CARRY_START: {
              guard: "notEditing",
              target: "dragging",
            },
            SELECT: {
              actions: assign(({ event }) => Selection.of(event.elementId)),
            },
            SELECT_SLOT: {
              target: "slot-selected",
              actions: assign(({ context, event }) => ({
                ...Selection.clearKeepLast(context),
                selectedSlot: {
                  parentId: event.parentId,
                  slotKey: event.slotKey,
                },
                slotExplicit: true,
              })),
            },
            OPEN_INSERT_SLOT: {
              guard: "notDragging",
              target: "inserting",
              actions: assign(({ event }) => ({
                selectedSlot: {
                  parentId: event.parentId,
                  slotKey: event.slotKey,
                },
                slotExplicit: false,
              })),
            },
            TOGGLE_SELECT: [
              {
                guard: "multiSelectEmptiesSet",
                target: "idle",
                actions: assign(() => ({
                  ...Selection.clear(),
                  hoveredId: null,
                })),
              },
              {
                actions: assign(({ context, event }) =>
                  Selection.toggle(context, event.elementId),
                ),
              },
            ],
            REPLACE_SELECT: [
              {
                guard: "replaceSelectEmpty",
                target: "idle",
                actions: assign(() => ({
                  ...Selection.clear(),
                  hoveredId: null,
                })),
              },
              {
                actions: assign(({ event }) =>
                  Selection.ofSet(
                    (event as { elementIds: string[] }).elementIds,
                  ),
                ),
              },
            ],
            DESELECT: {
              target: "idle",
              actions: assign(() => ({
                ...Selection.clear(),
                hoveredId: null,
              })),
            },
            ESCAPE: {
              guard: "notEditing",
              target: "idle",
              actions: assign(() => ({
                ...Selection.clear(),
                hoveredId: null,
              })),
            },
            OPEN_SHEET: {
              guard: "notDragging",
              target: "editing",
              actions: assign(({ context }) => ({
                ...Selection.collapseToLast(context),
                editing: context.lastSelectedId
                  ? { elementId: context.lastSelectedId, mode: "sheet" }
                  : null,
              })),
            },
            OPEN_INSERT: {
              guard: "notDragging",
              target: "inserting",
              actions: assign({ selectedSlot: null, slotExplicit: false }),
            },
            START_INLINE_EDIT: {
              guard: "notDragging",
              target: "editing",
              actions: assign(({ context, event }) => ({
                ...Selection.collapseToLast(context),
                editing:
                  event.trigger === "replace"
                    ? {
                        elementId: event.elementId,
                        mode: "inline" as const,
                        propKey: event.propKey,
                        original: event.original,
                        trigger: "replace" as const,
                        char: event.char,
                      }
                    : {
                        elementId: event.elementId,
                        mode: "inline" as const,
                        propKey: event.propKey,
                        original: event.original,
                        trigger: "select" as const,
                      },
              })),
            },
          },
        },
        editing: {
          on: {
            COMMIT_EDIT: {
              target: "selected",
              actions: assign({ editing: null }),
            },
            CANCEL_EDIT: {
              target: "selected",
              actions: assign({ editing: null }),
            },
            ESCAPE: {
              target: "selected",
              actions: assign({ editing: null }),
            },
            SELECT: {
              guard: "editingSheet",
              actions: assign(({ event }) => ({
                ...Selection.of(event.elementId),
                editing: { elementId: event.elementId, mode: "sheet" as const },
              })),
            },
          },
        },
        inserting: {
          on: {
            SELECT: {
              target: "selected",
              actions: assign(({ event }) => ({
                ...Selection.of(event.elementId),
                selectedSlot: null,
              })),
            },
            DESELECT: {
              target: "idle",
              actions: assign(() => ({
                ...Selection.clear(),
                hoveredId: null,
                selectedSlot: null,
              })),
            },
            ESCAPE: [
              {
                guard: "slotChosenExplicitly",
                target: "slot-selected",
              },
              {
                target: "selected",
                actions: assign({ selectedSlot: null, slotExplicit: false }),
              },
            ],
          },
        },
        "slot-selected": {
          on: {
            SELECT_SLOT: {
              actions: assign(({ event }) => ({
                selectedSlot: {
                  parentId: event.parentId,
                  slotKey: event.slotKey,
                },
                slotExplicit: true,
              })),
            },
            OPEN_INSERT: {
              guard: "notDragging",
              target: "inserting",
            },
            SELECT: {
              target: "selected",
              actions: assign(({ event }) => ({
                ...Selection.of(event.elementId),
                selectedSlot: null,
              })),
            },
            ESCAPE: {
              target: "selected",
              actions: assign(({ context }) => ({
                ...Selection.collapseToLast(context),
                selectedSlot: null,
              })),
            },
            DESELECT: {
              target: "idle",
              actions: assign(() => ({
                ...Selection.clear(),
                hoveredId: null,
                selectedSlot: null,
              })),
            },
            DRAG_START: {
              target: "dragging",
              actions: assign(({ context }) => ({
                ...Selection.collapseToLast(context),
                selectedSlot: null,
              })),
            },
            CARRY_START: {
              target: "dragging",
              actions: assign(({ context }) => ({
                ...Selection.collapseToLast(context),
                selectedSlot: null,
              })),
            },
          },
        },
        dragging: {
          on: {
            DROP: { target: "selected" },
            DRAG_CANCEL: { target: "selected" },
            CARRY_COMMIT: { target: "selected" },
            CARRY_CANCEL: { target: "selected" },
            ESCAPE: { target: "selected" },
          },
        },
      },
    },
    drag: {
      initial: "idle",
      states: {
        idle: {
          on: {
            DRAG_START: {
              guard: "notEditing",
              target: "dragging",
              actions: assign({
                dragSourceId: ({ event }) => event.sourceId,
              }),
            },
            CARRY_START: {
              guard: "notEditing",
              target: "carrying",
              actions: assign({
                dragSourceId: ({ event }) => event.sourceId,
              }),
            },
          },
        },
        dragging: {
          on: {
            DROP: {
              target: "idle",
              actions: assign({ dragSourceId: null }),
            },
            DRAG_CANCEL: {
              target: "idle",
              actions: assign({ dragSourceId: null }),
            },
            ESCAPE: {
              target: "idle",
              actions: assign({ dragSourceId: null }),
            },
          },
        },
        carrying: {
          on: {
            CARRY_COMMIT: {
              target: "idle",
              actions: assign({ dragSourceId: null }),
            },
            CARRY_CANCEL: {
              target: "idle",
              actions: assign({ dragSourceId: null }),
            },
            ESCAPE: {
              target: "idle",
              actions: assign({ dragSourceId: null }),
            },
          },
        },
      },
    },
  },
});

export type EditorSnapshot = SnapshotFrom<typeof editorMachine>;
