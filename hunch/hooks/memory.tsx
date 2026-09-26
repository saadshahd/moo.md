import type { Item } from "./band.tsx";

// The files that steer Claude across sessions: its auto-memory, and the instructions it loads.

/** Absolute path → last modification (ms). */
export type Snapshot = Record<string, number>;
/** `label`: the path as a person names it, and what a change request asks about. */
export type Steering = {
  path: string;
  label: string;
  state: "new" | "changed" | "deleted" | "retrieved";
};
/** Where the session's steering files live: auto-memory, the project, the user's config. */
export type Places = { memory: string; root: string; config: string };

/** The transcript sits at `<config>/projects/<project>/<session>.jsonl`, auto-memory beside it. */
export function places(
  transcriptPath: string,
  root: string,
): Places | undefined {
  const parts = transcriptPath.split("/");
  if (parts.length < 5 || parts.at(-3) !== "projects") return undefined;
  return {
    memory: `${parts.slice(0, -1).join("/")}/memory`,
    root,
    config: parts.slice(0, -3).join("/"),
  };
}

const STEERING = /(^|\/)(CLAUDE(\.local)?\.md|AGENTS\.md)$|^\.claude\//;

/** A project file, by its path from the root, that Claude loads as instructions or settings.
 * Worktrees under .claude/ are copies of the project, not instructions. */
export function isSteering(relative: string): boolean {
  return STEERING.test(relative) && !relative.startsWith(".claude/worktrees/");
}

/** Any absolute path that is a steering file: auto-memory, a project one, the user's CLAUDE.md. */
export function isSteeringPath(path: string, p: Places): boolean {
  if (path.startsWith(`${p.memory}/`) || path === `${p.config}/CLAUDE.md`)
    return true;
  return (
    path.startsWith(`${p.root}/`) && isSteering(path.slice(p.root.length + 1))
  );
}

export function label(path: string, p: Places): string {
  if (path.startsWith(`${p.memory}/`))
    return `memory/${path.slice(p.memory.length + 1)}`;
  if (path.startsWith(`${p.root}/`)) return path.slice(p.root.length + 1);
  return p.config.endsWith("/.claude")
    ? `~/.claude${path.slice(p.config.length)}`
    : path;
}

export function changes(
  before: Snapshot,
  after: Snapshot,
  p: Places,
): Steering[] {
  const paths = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].sort();
  return paths.flatMap((path): Steering[] => {
    const state = !(path in before)
      ? "new"
      : !(path in after)
        ? "deleted"
        : before[path] !== after[path]
          ? "changed"
          : undefined;
    return state ? [{ path, label: label(path, p), state }] : [];
  });
}

/** The files the session read or loaded, once each; one it also updated is listed there alone. */
export function retrieved(
  paths: string[],
  updated: Steering[],
  p: Places,
): Steering[] {
  const shown = new Set(updated.map((u) => u.path));
  return [...new Set(paths)]
    .filter((path) => !shown.has(path))
    .sort()
    .map((path) => ({
      path,
      label: label(path, p),
      state: "retrieved" as const,
    }));
}

/** One row a file: view it in the pane, open it in the editor, or ask Claude to change it. */
function fileRow(f: Steering): Item[] {
  const gone = f.state === "deleted";
  return [
    {
      id: `${gone ? "note:mem" : "view"}:${f.path}`,
      label: f.label,
      kind: gone ? "note" : "line",
      column: true,
    },
    ...(f.state === "retrieved"
      ? []
      : [
          {
            id: `note:mem-state:${f.path}`,
            label: f.state,
            kind: "note" as const,
          },
        ]),
    ...(gone
      ? []
      : [{ id: `edit:${f.path}`, label: "edit", kind: "quiet" as const }]),
    { id: `ask:${f.label}`, label: "ask", kind: "quiet" },
  ];
}

/** Updated or added files, then retrieved ones, each under its heading; an empty section is left out. */
export function memoryRows(files: Steering[]): Item[][] {
  const sections = [
    ["updated", files.filter((f) => f.state !== "retrieved")],
    ["retrieved", files.filter((f) => f.state === "retrieved")],
  ] as const;
  return sections
    .filter(([, fs]) => fs.length)
    .flatMap(([heading, fs], i) => [
      ...(i ? [[]] : []),
      [{ id: `note:mem-${heading}`, label: heading, kind: "note" as const }],
      ...fs.map(fileRow),
    ]);
}
