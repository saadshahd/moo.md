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
      { ROUNDUP_TERMINAL: "1", TERM_PROGRAM: "ghostty" },
      true,
      false,
    ],
    [
      "roundup naming itself iTerm2",
      {
        ROUNDUP_TERMINAL: "1",
        TERM_PROGRAM: "iTerm.app",
        TERM_PROGRAM_VERSION: "3.5.0",
      },
      true,
      true,
    ],
    ["tmux", { TMUX: "/tmp/tmux", TERM_PROGRAM: "ghostty" }, true, false],
    [
      "the person's word",
      { HOLD_VIEW_PIXELS: "0", TERM_PROGRAM: "ghostty" },
      true,
      false,
    ],
  ];

  for (const [name, env, isFullscreen, want] of cases)
    test(name, () => expect(drawsPixels(env, isFullscreen)).toBe(want));
});

/** The world under the plugin: bun drawing a 40 by 10 box, a file system, a window program. */
function world(
  on: On,
  env: Record<string, string>,
  draw: { exitCode: number; stderr?: string } | "no bun" = { exitCode: 0 },
) {
  const runs: string[][] = [];
  const toasts: string[] = [];
  const windows: { argv: string[]; isEnded: boolean }[] = [];
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
  on("fs.stat", () => ({
    value: { kind: "file" as const, size: 10, mtimeMs: 1, isLink: false },
  }));
  on("ui.toast", (_$, e) => {
    toasts.push(e.text);

    return { value: undefined };
  });
  on("process.spawn", async function* (_$, e) {
    const w = { argv: [...e.argv], isEnded: false };

    windows.push(w);
    try {
      yield { stream: "stdout" as const, text: "shown\n" };
      for (;;) {
        await clock.sleep(100);
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

  return { runs, toasts, windows, clock, drawn };
}

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

test("a closed fence draws as an Image in place, its source one press away", async ($, on) => {
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
  const source = (await ui.findAll({ type: "Button" })).find(
    (b) => b.props.label === "source",
  )!;

  await ui.press({ key: source.props.key as string });
  expect(
    await ui.find({ type: "Markdown", text: /```mermaid\nflowchart LR/ }),
  ).toBeDefined();
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

test("where the terminal draws no pixels, the diagram opens in a window by the pointer and closes on a second press", async ($, on) => {
  const w = world(on, APPLE);
  const ui = await reply($, REPLY);
  const open = await settled(
    async () =>
      (await ui.findAll({ type: "Button" })).find(
        (b) => b.props.label === "open",
      ),
    (x) => x !== undefined,
  );

  expect(await ui.find({ type: "Image" })).toBeUndefined();
  expect(
    await ui.find({ type: "Text", text: "Mermaid diagram: flowchart LR" }),
  ).toBeDefined();
  await ui.press({ key: open!.props.key as string });
  await settled(
    async () => w.windows.length,
    (n) => n === 1,
  );
  expect(w.windows[0]!.argv.slice(0, 3)).toEqual([
    "osascript",
    "-l",
    "JavaScript",
  ]);
  expect(
    (await ui.findAll({ type: "Button" })).some(
      (b) => b.props.label === "close",
    ),
  ).toBe(true);
  await ui.press({ key: open!.props.key as string });
  expect(w.windows[0]!.isEnded).toBe(false);
  await w.clock.advance(100);
  expect(w.windows[0]!.isEnded).toBe(true);
  expect(
    (await ui.findAll({ type: "Button" })).some((b) => b.props.label === "open"),
  ).toBe(true);
  await ui.unmount();
});

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
