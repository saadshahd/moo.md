import { describe, expect, test } from "claude-code/testing";
import { changes, isSteering, isSteeringPath, memoryRows, places, retrieved } from "./memory.tsx";

const TRANSCRIPT = "/Users/u/.claude/projects/-repo/abc.jsonl";
const P = {
  memory: "/Users/u/.claude/projects/-repo/memory",
  root: "/repo",
  config: "/Users/u/.claude",
};

describe("steering files", () => {
  test("auto-memory sits beside the transcript, the config two folders up", async () => {
    expect(places(TRANSCRIPT, "/repo")).toEqual(P);
    expect(places("", "/repo")).toBe(undefined);
  });
  test("CLAUDE.md and AGENTS.md at any depth, and .claude/ but its worktrees", async () => {
    expect(
      [
        "CLAUDE.md",
        "a/CLAUDE.md",
        "CLAUDE.local.md",
        "a/AGENTS.md",
        ".claude/settings.json",
        ".claude/skills/x/SKILL.md",
      ].every(isSteering),
    ).toBe(true);
    expect(
      [
        ".claude/worktrees/w/CLAUDE.md",
        "README.md",
        "NOTCLAUDE.md",
        ".claude/worktrees/w/",
      ].some(isSteering),
    ).toBe(false);
  });
  test("nothing changed is empty; each change names the file as a person would", async () => {
    const m = `${P.memory}/a.md`;
    expect(changes({ [m]: 1 }, { [m]: 1 }, P)).toEqual([]);
    expect(
      changes(
        { [m]: 1, "/repo/CLAUDE.md": 1 },
        { [m]: 2, "/Users/u/.claude/CLAUDE.md": 1 },
        P,
      ),
    ).toEqual([
      {
        path: "/Users/u/.claude/CLAUDE.md",
        label: "~/.claude/CLAUDE.md",
        state: "new",
      },
      { path: m, label: "memory/a.md", state: "changed" },
      { path: "/repo/CLAUDE.md", label: "CLAUDE.md", state: "deleted" },
    ]);
  });
  test("retrieved: read or loaded steering files, once each, none also updated", async () => {
    const m = `${P.memory}/a.md`;
    expect(isSteeringPath(m, P) && isSteeringPath("/repo/a/AGENTS.md", P) && !isSteeringPath("/repo/src/a.ts", P)).toBe(true);
    expect(retrieved([m, "/repo/CLAUDE.md", m], [{ path: "/repo/CLAUDE.md", label: "CLAUDE.md", state: "changed" }], P)).toEqual([
      { path: m, label: "memory/a.md", state: "retrieved" },
    ]);
  });
  test("updated files, then retrieved ones, each under its heading; a row views, edits or asks", async () => {
    const rows = memoryRows([
      { path: "/repo/CLAUDE.md", label: "CLAUDE.md", state: "changed" },
      { path: "/repo/AGENTS.md", label: "AGENTS.md", state: "deleted" },
      { path: `${P.memory}/a.md`, label: "memory/a.md", state: "retrieved" },
    ]);
    expect(rows.map((r) => r.map((i) => i.label))).toEqual([
      ["updated"],
      ["CLAUDE.md", "changed", "edit", "ask"],
      ["AGENTS.md", "deleted", "ask"],
      [],
      ["retrieved"],
      ["memory/a.md", "edit", "ask"],
    ]);
    expect(rows[1].map((i) => i.id)).toEqual(["view:/repo/CLAUDE.md", "note:mem-state:/repo/CLAUDE.md", "edit:/repo/CLAUDE.md", "ask:CLAUDE.md"]);
    expect(memoryRows([{ path: "/repo/CLAUDE.md", label: "CLAUDE.md", state: "retrieved" }])[0]).toEqual([
      { id: "note:mem-retrieved", label: "retrieved", kind: "note" },
    ]);
  });
});

// The engine beneath tend: a git project and a memory folder (path → mtime), and a store.
function world(on: any, files: () => Record<string, number>): Map<string, unknown> {
  const store = new Map<string, unknown>();
  on("store.get", ($: any, e: any) => ({ value: store.get(e.key) }));
  on("store.set", ($: any, e: any) => (store.set(e.key, e.value), { value: undefined }));
  on("classic.SessionStart", () => ({}));
  on("classic.Stop", () => ({}));
  on("session.id", () => ({ value: "s1" }));
  on("session.root", () => ({ value: "/repo" }));
  on("ui.invalidate", () => ({ value: undefined }));
  on("session.usage", () => ({ value: { context: { window: 1, breakdown: { memoryFiles: [{ path: "/repo/CLAUDE.md", type: "Project", tokens: 1 }] } } } }));
  on("session.messages", () => ({
    value: [{ role: "assistant", text: "", toolUses: [{ tool: "Read", input: { file_path: `${P.memory}/old.md` } }, { tool: "Read", input: { file_path: "/repo/src/a.ts" } }] }],
  }));
  on("process.run", () => ({
    value: {
      exitCode: 0,
      stderr: "",
      stdout: Object.keys(files())
        .filter((f) => f.startsWith("/repo/"))
        .map((f) => f.slice(6))
        .join("\0"),
    },
  }));
  on("fs.exists", ($: any, e: any) => ({ value: e.path === P.memory || e.path in files() }));
  on("fs.list", () => ({
    value: Object.keys(files())
      .filter((f) => f.startsWith(`${P.memory}/`))
      .map((f) => ({
        name: f.slice(P.memory.length + 1),
        kind: "file",
        size: 1,
        isLink: false,
      })),
  }));
  on("fs.stat", ($: any, e: any) => ({ value: { kind: "file", size: 1, isLink: false, mtimeMs: files()[e.path] } }));
  return store;
}

describe("at stop", () => {
  test("a steering file changed since the session started: listed as updated, the rest read as retrieved", async ($, on) => {
    let files: Record<string, number> = {
      "/repo/CLAUDE.md": 1,
      "/repo/src/a.ts": 1,
    };
    const store = world(on, () => files);
    await $.classic.SessionStart({
      source: "startup",
      transcript_path: TRANSCRIPT,
    });
    await $.classic.Stop({
      stop_hook_active: false,
      transcript_path: TRANSCRIPT,
    });
    files = {
      "/repo/CLAUDE.md": 2,
      "/repo/src/a.ts": 2,
      [`${P.memory}/tabs.md`]: 2,
    };
    await $.classic.Stop({
      stop_hook_active: false,
      transcript_path: TRANSCRIPT,
    });
    expect(store.get("tend:s1:memory")).toEqual([
      {
        path: "/Users/u/.claude/projects/-repo/memory/tabs.md",
        label: "memory/tabs.md",
        state: "new",
      },
      { path: "/repo/CLAUDE.md", label: "CLAUDE.md", state: "changed" },
      { path: `${P.memory}/old.md`, label: "memory/old.md", state: "retrieved" },
    ]);
  });
  test("nothing changed: only what was retrieved", async ($, on) => {
    const store = world(on, () => ({ "/repo/CLAUDE.md": 1 }));
    await $.classic.SessionStart({
      source: "startup",
      transcript_path: TRANSCRIPT,
    });
    await $.classic.Stop({
      stop_hook_active: false,
      transcript_path: TRANSCRIPT,
    });
    await $.classic.Stop({
      stop_hook_active: false,
      transcript_path: TRANSCRIPT,
    });
    expect(store.get("tend:s1:memory")).toEqual([
      { path: `${P.memory}/old.md`, label: "memory/old.md", state: "retrieved" },
      { path: "/repo/CLAUDE.md", label: "CLAUDE.md", state: "retrieved" },
    ]);
  });
});
