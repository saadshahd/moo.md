import type { On } from "claude-code";
import { describe, expect, mock, test, type Engine } from "claude-code/testing";
import { altOf, segments } from "./fences.ts";
import { cleanMarkdown, viewable } from "./files.ts";
import { drawsPixels } from "./terminal.ts";

const FLOW = "flowchart LR\n  A[Read] --> B{Image?}";
const fence = (src: string) => "```mermaid\n" + src + "\n```";
const REPLY = `Here is the flow:\n\n${fence(FLOW)}\n\nThat is all.`;
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
const GHOSTTY = {
  TERM_PROGRAM: "ghostty",
  TERM: "xterm-ghostty",
  TMPDIR: "/tmp/",
};
const APPLE = {
  TERM_PROGRAM: "Apple_Terminal",
  TERM: "xterm-256color",
  TMPDIR: "/tmp/",
};

describe("segments", () => {
  test("a closed fence is cut out of the prose around it", () => {
    expect(segments(REPLY)).toEqual([
      { md: "Here is the flow:" },
      { mermaid: FLOW },
      { md: "That is all." },
    ]);
  });

  test("a fence still streaming is `writing`, never drawn half", () => {
    expect(segments("Look:\n```mermaid\nflowchart LR\n  A --")).toEqual([
      { md: "Look:" },
      { writing: "flowchart LR\n  A --" },
    ]);
    expect(segments("```mermaid")).toEqual([{ writing: "" }]);
  });

  test("a fence quoted or indented is prose", () => {
    const quoted = "It said:\n> ```mermaid\n> flowchart LR\n> ```";

    expect(segments(quoted)).toEqual([{ md: quoted }]);
    expect(segments("- a\n  ```mermaid\n  flowchart LR\n  ```")).toHaveLength(
      1,
    );
  });

  test("two fences, back to back", () => {
    expect(segments(`${fence("pie")}\n${fence("graph TD")}`)).toEqual([
      { mermaid: "pie" },
      { mermaid: "graph TD" },
    ]);
  });

  test("a diagram is known by its first line that is no comment", () => {
    expect(altOf("%% note\nsequenceDiagram\n A->>B: x")).toBe(
      "Mermaid diagram: sequenceDiagram",
    );
  });
});

describe("viewable", () => {
  test("Read, Write and Edit name their file; only pictures and markdown count", () => {
    expect(viewable("Read", { file_path: "/a/shot.png" }, {})).toEqual([
      "/a/shot.png",
    ]);
    expect(
      viewable(
        "Write",
        { file_path: "/a/README.md" },
        { filePath: "/a/README.md" },
      ),
    ).toEqual(["/a/README.md"]);
    expect(viewable("Edit", { file_path: "/a/main.ts" }, {})).toEqual([]);
    expect(viewable("Read", { file_path: "/a/x.webp" }, {})).toEqual([]);
  });

  test("Bash names the files its command changed, less the deleted", () => {
    const output = {
      stdout: "",
      bashEditDiff: {
        files: [
          { filePath: "/r/a.md", hunks: [] },
          { filePath: "/r/gone.png", hunks: [], deleted: true },
        ],
        moreFiles: 0,
        changedFiles: ["/r/a.md", "/r/plot.png", "/r/x.ts"],
      },
    };

    expect(viewable("Bash", { command: "make" }, output)).toEqual([
      "/r/a.md",
      "/r/plot.png",
    ]);
  });

  test("markdown keeps tab and newline as its only control characters", () => {
    expect(cleanMarkdown("a\r\nb\u001b[31mc\td").text).toBe("a\nb[31mc\td");
    expect(cleanMarkdown("x".repeat(100_000)).isCut).toBe(true);
  });
});

describe("drawsPixels", () => {
  const cases: [string, Record<string, string>, boolean, boolean][] = [
    ["Ghostty", { TERM_PROGRAM: "ghostty" }, false, true],
    ["kitty", { TERM: "xterm-kitty" }, false, true],
    [
      "iTerm2 3.5 fullscreen",
      { TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.6.11" },
      true,
      true,
    ],
    [
      "iTerm2 3.5 on the main screen",
      { TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.6.11" },
      false,
      false,
    ],
    [
      "iTerm2 3.4",
      { TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.4.23" },
      true,
      false,
    ],
    [
      "Terminal.app",
      { TERM_PROGRAM: "Apple_Terminal", TERM: "xterm-256color" },
      true,
      false,
    ],
    [
      "roundup, whatever it inherited",
      { ROUNDUP_TERMINAL: "1", TERM_PROGRAM: "Apple_Terminal" },
      false,
      true,
    ],
    ["tmux", { TMUX: "/tmp/tmux", TERM_PROGRAM: "ghostty" }, true, false],
  ];

  for (const [name, env, isFullscreen, want] of cases)
    test(name, () => expect(drawsPixels(env, isFullscreen)).toBe(want));
});

/** The world under the plugin: bun drawing a 40 by 10 box, a file system, a window program. */
function world(
  on: On,
  env: Record<string, string>,
  draw: { exitCode: number; stderr?: string } | "no bun" = { exitCode: 0 },
  program: "beats" | "silent" | "exits" = "beats",
) {
  const runs: string[][] = [];
  const toasts: string[] = [];
  const windows: {
    argv: string[];
    env: Record<string, string>;
    isEnded: boolean;
  }[] = [];
  const clock = mock.clock(on);

  mock.env(on, env);
  on(
    "config.list",
    () => ({ value: [{ key: "theme", value: "light" }] }) as never,
  );
  on("process.run", (_$, e) => {
    runs.push([...e.argv]);
    const isDraw = e.argv[0] === "bun";

    if (isDraw && draw === "no bun") throw new Error("ENOENT: bun");
    const stdout = isDraw
      ? '{"columns":40,"rows":10}'
      : e.argv[0] === "uname"
        ? "Darwin\n"
        : e.argv[0] === "osascript"
          ? JSON.stringify(POINTER)
          : "";
    const failed = isDraw && draw !== "no bun" ? draw : { exitCode: 0, stderr: "" };

    return {
      value: {
        exitCode: failed.exitCode,
        stdout,
        stderr: failed.stderr ?? "",
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    };
  });
  on("fs.read", (_$, e) => ({
    value: e.as === "bytes" ? { base64: PNG } : "# Notes\n\nbody",
  }));
  const files = { isGone: false };

  on("fs.stat", () => {
    if (files.isGone) throw new Error("ENOENT: no such file");

    return { value: { kind: "file" as const, size: 10, mtimeMs: 1, isLink: false } };
  });
  on("ui.toast", (_$, e) => {
    toasts.push(e.text);

    return { value: undefined };
  });
  // A window program: it beats, goes quiet, or exits on its own (a click on it, Escape, its parent gone).
  on("process.spawn", async function* (_$, e, next) {
    const w = { argv: [...e.argv], env: { ...e.env }, isEnded: false };

    windows.push(w);
    next.signal.addEventListener("abort", () => (w.isEnded = true));
    try {
      yield { stream: "stdout" as const, text: "shown\n" };
      if (program === "exits") return { value: { code: 0, signal: null } };
      for (;;) {
        await (program === "silent" ? new Promise(() => {}) : clock.sleep(100));
        yield { stream: "stdout" as const, text: ".\n" };
      }
    } finally {
      w.isEnded = true;
    }
  });
  const drawn: string[] = [];

  on("ui.render", ($, e) => {
    const { Box } = $.ui.resolve(e);

    if (e.component === "AssistantMessage") drawn.push(e.props.text);
    return <Box key="engine" />;
  });

  return { runs, toasts, windows, clock, drawn, files };
}

/** The pointer on the button, on a 1440 by 900 point screen whose menu bar takes 25. */
const POINTER = {
  x: 300,
  y: 200,
  area: { x: 0, y: 25, width: 1440, height: 875 },
  scale: 2,
};

const VIEWPORT = { columns: 100, rows: 40, isFullscreen: true };

const reply = ($: Engine, text: string) =>
  $.ui.mount({
    plugin: "hold",
    surface: "terminal",
    component: "AssistantMessage",
    props: { text, isFirstOfReply: true },
    viewport: VIEWPORT,
  });

/** Waits out the drawing the render started unawaited, then reads the tree again. */
async function settled<T>(
  read: () => Promise<T>,
  isDone: (t: T) => boolean,
): Promise<T> {
  for (let i = 0; i < 100; i++) {
    const t = await read();

    if (isDone(t)) return t;
    await Promise.resolve();
  }

  return read();
}

test("a closed fence draws as an Image in place, with no button under it", async ($, on) => {
  const w = world(on, GHOSTTY);
  const ui = await reply($, REPLY);
  const image = await settled(
    () => ui.find({ type: "Image" }),
    (x) => x !== undefined,
  );

  expect(image?.props).toMatchObject({
    source: { png: PNG },
    columns: 40,
    rows: 10,
  });
  expect(w.runs.filter((r) => r[0] === "bun")).toHaveLength(1);
  expect(w.runs[0]).toEqual([
    "bun",
    expect.stringMatching(/\/draw\/draw\.ts$/),
    "mermaid",
    "light",
    expect.stringMatching(/^\/tmp\/moo-hold-view\/[0-9a-f]{24}\.png$/),
  ]);
  // The engine draws the first prose, and the bullet that opens the reply with it.
  expect(w.drawn).toContain("Here is the flow:");
  expect(await ui.find({ type: "Markdown", text: "That is all." })).toBeDefined();
  expect(
    await ui.find({ type: "Markdown", text: /```mermaid/ }),
  ).toBeUndefined();
  expect(await ui.findAll({ type: "Button" })).toHaveLength(0);
  await ui.unmount();
});

test("one source is drawn once, however often it is shown", async ($, on) => {
  const w = world(on, GHOSTTY);
  const a = await reply($, REPLY);
  const b = await reply($, `again\n\n${fence(FLOW)}`);

  await settled(
    () => b.find({ type: "Image" }),
    (x) => x !== undefined,
  );
  expect(w.runs.filter((r) => r[0] === "bun")).toHaveLength(1);
  await a.unmount();
  await b.unmount();
});

test("a fence still streaming draws nothing and runs nothing", async ($, on) => {
  const w = world(on, GHOSTTY);
  const ui = await reply($, "Look:\n```mermaid\nflowchart LR\n  A --");

  expect(await ui.find({ type: "Text", text: /being written/ })).toBeDefined();
  expect(w.runs.some((r) => r[0] === "bun")).toBe(false);
  await ui.unmount();
});

test("a diagram that fails to draw passes the reply on unchanged and says why once", async ($, on) => {
  const w = world(on, GHOSTTY, {
    exitCode: 1,
    stderr: "Parse error on line 2:\n A-->\n-----^",
  });
  const ui = await reply($, REPLY);

  await settled(
    () => ui.find({ key: "engine" }),
    (x) => x !== undefined,
  );
  expect(await ui.find({ type: "Image" })).toBeUndefined();
  await reply($, REPLY);
  expect(w.toasts).toEqual([
    expect.stringMatching(
      /^hold: a Mermaid diagram did not draw.*Parse error on line 2: A--> -----\^$/,
    ),
  ]);
});

test("without bun the reply passes on, and the toast names bun", async ($, on) => {
  const w = world(on, GHOSTTY, "no bun");

  const ui = await reply($, REPLY);

  await settled(
    () => ui.find({ key: "engine" }),
    (x) => x !== undefined,
  );
  expect(w.toasts.join()).toMatch(/could not run bun.*https:\/\/bun\.sh/);
});

/** Mounts the reply where no pixels draw, and the label of its first window button. */
async function windowed($: Engine, text = REPLY) {
  const ui = await reply($, text);
  const buttons = await settled(
    () => ui.findAll({ type: "Button" }),
    (b) => b.length > 0 && b.every((x) => x.props.label === "open"),
  );
  const label = async (key: string) => (await ui.find({ key }))?.props.label;

  return { ui, keys: buttons.map((b) => b.props.key as string), label };
}

const windowsUp = (w: ReturnType<typeof world>, n: number) =>
  settled(
    async () => w.windows.length,
    (x) => x === n,
  );

test("where the terminal draws no pixels, the diagram opens in a window under the pointer and closes on a second press", async ($, on) => {
  const w = world(on, APPLE);
  const { ui, keys, label } = await windowed($);

  expect(await ui.find({ type: "Image" })).toBeUndefined();
  expect(
    await ui.find({ type: "Text", text: "Mermaid diagram: flowchart LR" }),
  ).toBeDefined();
  await ui.press({ key: keys[0]! });
  await windowsUp(w, 1);
  expect(w.windows[0]!.argv.slice(0, 3)).toEqual(["osascript", "-l", "JavaScript"]);
  // The 1 by 1 pixel PNG at a scale of 2, in its 6 point border, its left edge at the pointer, 24 below.
  expect(w.windows[0]!.env.HOLD_WINDOW_RECT).toBe("300 224 13 13");
  expect(await label(keys[0]!)).toBe("close");
  await ui.press({ key: keys[0]! });
  expect(w.windows[0]!.isEnded).toBe(true);
  expect(await label(keys[0]!)).toBe("open");
  await ui.unmount();
});

test("each open first ends every window open, of any session; a second window ends the first", async ($, on) => {
  const w = world(on, APPLE);
  const { ui, keys } = await windowed($, `${fence(FLOW)}\n\n${fence("pie")}`);
  const pkills = () => w.runs.filter((r) => r[0] === "pkill");

  await ui.press({ key: keys[0]! });
  await windowsUp(w, 1);
  expect(pkills()).toEqual([["pkill", "-f", "moo-hold-view-window"]]);
  await ui.press({ key: keys[1]! });
  await windowsUp(w, 2);
  expect(w.windows.map((x) => x.isEnded)).toEqual([true, false]);
  expect(pkills()).toHaveLength(2);
  await ui.unmount();
});

test("a window program gone quiet still ends on the second press", async ($, on) => {
  const w = world(on, APPLE, undefined, "silent");
  const { ui, keys, label } = await windowed($);

  await ui.press({ key: keys[0]! });
  await windowsUp(w, 1);
  await ui.press({ key: keys[0]! });
  expect(w.windows[0]!.isEnded).toBe(true);
  expect(await label(keys[0]!)).toBe("open");
});

test("the session ending, a /clear among its ways, ends the window", async ($, on) => {
  const w = world(on, APPLE);
  on("session.end", (_$, e) => ({ sessionId: e.sessionId }));
  const { ui, keys } = await windowed($);

  await ui.press({ key: keys[0]! });
  await windowsUp(w, 1);
  await $.session.end({ reason: "clear", sessionId: "s1" } as never);
  await settled(
    async () => w.windows[0]!.isEnded,
    (x) => x,
  );
  expect(w.windows[0]!.isEnded).toBe(true);
});

test("a window lives two minutes at most, whatever its program does", async ($, on) => {
  const w = world(on, APPLE, undefined, "silent");
  const { ui, keys, label } = await windowed($);

  await ui.press({ key: keys[0]! });
  await windowsUp(w, 1);
  expect(w.windows[0]!.env.HOLD_WINDOW_LIFE).toBe("120");
  await w.clock.advance(119_000);
  expect(w.windows[0]!.isEnded).toBe(false);
  await w.clock.advance(1_000);
  expect(w.windows[0]!.isEnded).toBe(true);
  expect(await label(keys[0]!)).toBe("open");
});

test("a window its program closed (a click on it, Escape, its parent gone) reads [open] again, unannounced", async ($, on) => {
  const w = world(on, APPLE, undefined, "exits");
  const { ui, keys, label } = await windowed($);

  await ui.press({ key: keys[0]! });
  await windowsUp(w, 1);
  expect(
    await settled(
      () => label(keys[0]!),
      (x) => x === "open",
    ),
  ).toBe("open");
  expect(w.toasts).toEqual([]);
});

test("a picture's window closes on the second press without reading its file again", async ($, on) => {
  const w = world(on, APPLE);
  const ui = await $.ui.mount(
    TOOL("Read", { file_path: "/r/shot.png" }, { type: "image", file: {} }),
  );
  const key = "view-toolu_1-/r/shot.png";

  await ui.press({ key });
  await windowsUp(w, 1);
  w.files.isGone = true;
  await ui.press({ key });
  expect(w.windows[0]!.isEnded).toBe(true);
  expect((await ui.find({ key }))?.props.label).toBe("view");
  expect(w.toasts).toEqual([]);
});

type Node = { type: string; props?: Record<string, unknown>; children?: unknown[] };

/**
 * Where the first `type` element sits in a drawn tree: inside a bordered Box, and after the
 * tree's first Button in document order, which on the terminal is above it.
 */
function layout(tree: unknown, type: string) {
  let isUnderButton = false;
  let sawButton = false;
  let found: Node[] | undefined;

  const walk = (n: unknown, up: Node[]) => {
    if (found || !n || typeof n !== "object") return;
    const node = n as Node;

    if (node.type === "Button") sawButton = true;
    if (node.type === type) {
      found = up;
      isUnderButton = sawButton;
      return;
    }
    for (const c of node.children ?? []) walk(c, [...up, node]);
  };

  walk(tree, []);

  return { isFramed: !!found?.some((n) => n.type === "Box" && n.props?.borderStyle), isUnderButton };
}

const TOOL = (tool: string, input: unknown, output: unknown) => ({
  plugin: "hold",
  surface: "terminal" as const,
  component: "ToolUse" as const,
  requestId: "toolu_1",
  props: {
    tool_use_id: "toolu_1",
    tool,
    input,
    output,
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
  },
  viewport: VIEWPORT,
});

test("a markdown file Claude wrote gets [view]: one press unfolds it in place, the next folds it", async ($, on) => {
  world(on, GHOSTTY);
  const ui = await $.ui.mount(
    TOOL(
      "Write",
      { file_path: "/r/notes.md", content: "x" },
      { filePath: "/r/notes.md" },
    ),
  );
  const key = "view-toolu_1-/r/notes.md";

  expect(await ui.find({ key: "engine" })).toBeDefined();
  expect(await ui.find({ type: "Markdown" })).toBeUndefined();
  await ui.press({ key });
  expect(await ui.find({ type: "Markdown", text: /# Notes/ })).toBeDefined();
  expect((await ui.find({ key }))?.props.label).toBe("fold");
  expect(layout(await ui.drawn(), "Markdown")).toEqual({ isFramed: true, isUnderButton: true });
  await ui.press({ key });
  expect(await ui.find({ type: "Markdown" })).toBeUndefined();
  await ui.unmount();
});

test("a picture Claude read unfolds as an Image, drawn once", async ($, on) => {
  const w = world(on, GHOSTTY);
  const ui = await $.ui.mount(
    TOOL("Read", { file_path: "/r/shot.png" }, { type: "image", file: {} }),
  );

  await ui.press({ key: "view-toolu_1-/r/shot.png" });
  expect((await ui.find({ type: "Image" }))?.props).toMatchObject({
    source: { png: PNG },
    alt: "shot.png",
  });
  expect(layout(await ui.drawn(), "Image")).toEqual({ isFramed: true, isUnderButton: true });
  expect(
    w.runs.filter((r) => r[0] === "bun").map((r) => r.slice(2, 4)),
  ).toEqual([["picture", "/r/shot.png"]]);
  await ui.unmount();
});

test("a running, failed or plain-text tool row draws as the engine draws it", async ($, on) => {
  world(on, GHOSTTY);
  const running = await $.ui.mount({
    ...TOOL("Read", { file_path: "/r/a.png" }, undefined),
    props: {
      ...TOOL("Read", { file_path: "/r/a.png" }, undefined).props,
      isRunning: true,
    },
  });

  expect(await running.findAll({ type: "Button" })).toHaveLength(0);
  await running.unmount();
  const ts = await $.ui.mount(TOOL("Read", { file_path: "/r/a.ts" }, {}));

  expect(await ts.findAll({ type: "Button" })).toHaveLength(0);
});
