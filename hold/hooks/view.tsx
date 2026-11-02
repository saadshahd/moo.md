import type {
  Elements,
  EngineInterface,
  Register,
  RenderElement,
  RenderViewport,
} from "claude-code";
import { altOf, hasMermaid, segments } from "./fences.ts";
import { cleanMarkdown, kindOf, nameOf, viewable } from "./files.ts";
import { drawsPixels, type TermEnv } from "./terminal.ts";
import { LINUX, MACOS } from "./window.ts";

/** A PNG `draw/draw.ts` wrote, and the box of cells it fills. */
type Picture = { png: string; file: string; columns: number; rows: number };
type Drawn = Picture | { error: string };
type Box = { columns: number; rows: number };

// What a hot reload may drop: a dropped drawing is drawn again, a dropped view folds.
const drawings = new Map<string, Drawn>();
const pending = new Map<string, Promise<Drawn>>();
/** The [source] and [view] opened, by their Button's key. */
const opened = new Set<string>();
/** An opened markdown view's text, or why it has none, by its Button's key. */
const docs = new Map<
  string,
  { text: string; isCut: boolean } | { error: string }
>();
/** An opened picture view's drawing, by its Button's key. */
const pictures = new Map<string, string>();
const toasted = new Set<string>();
let theme: Promise<string> | undefined;
let termEnv: Promise<TermEnv> | undefined;
let windowing: Promise<"macos" | "linux" | null> | undefined;
let popover: { key: string; isOpen: boolean } | undefined;

const messageOf = (err: unknown) =>
  err instanceof Error ? err.message : String(err);
const redraw = ($: EngineInterface) => $.ui.invalidate("ui.render");

/** Shows `why` once a session, as hooks fail: the event it met passes on unchanged. */
function failOnce($: EngineInterface, why: string) {
  const text = `hold: ${why}`;

  if (toasted.has(text)) return;
  toasted.add(text);
  $.ui.toast(text);
}

async function hash(text: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );

  return [...digest.slice(0, 12)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The session's theme, as `/config` names it. */
function themeOf($: EngineInterface): Promise<string> {
  theme ??= $.config.list().then((rows) => {
    const v = rows.find((r) => r.key === "theme")?.value;

    return typeof v === "string" ? v : "dark";
  });

  return theme;
}

function pixelsHere(
  $: EngineInterface,
  viewport: RenderViewport | undefined,
): Promise<boolean> {
  termEnv ??= (async () => ({
    HOLD_VIEW_PIXELS: await $.env.get("HOLD_VIEW_PIXELS"),
    TERM_PROGRAM: await $.env.get("TERM_PROGRAM"),
    TERM_PROGRAM_VERSION: await $.env.get("TERM_PROGRAM_VERSION"),
    TERM: await $.env.get("TERM"),
    KITTY_WINDOW_ID: await $.env.get("KITTY_WINDOW_ID"),
    ROUNDUP_TERMINAL: await $.env.get("ROUNDUP_TERMINAL"),
    TMUX: await $.env.get("TMUX"),
    CLAUDE_CODE_FORCE_TERMINAL_IMAGES: await $.env.get(
      "CLAUDE_CODE_FORCE_TERMINAL_IMAGES",
    ),
  }))();

  return termEnv.then((env) =>
    drawsPixels(env, viewport?.isFullscreen === true),
  );
}

/** Which system's program opens a picture in a window by the pointer; none over ssh. */
function windowOf($: EngineInterface) {
  windowing ??= (async () => {
    if ((await $.env.get("SSH_CONNECTION")) || (await $.env.get("SSH_TTY")))
      return null;
    const os = (
      await $.process.run(["uname", "-s"]).catch(() => undefined)
    )?.stdout.trim();

    if (os === "Darwin") return "macos";
    if (os !== "Linux" || !(await $.env.get("DISPLAY"))) return null;
    const tk = await $.process
      .run(["python3", "-c", "import tkinter"])
      .catch(() => undefined);

    return tk?.exitCode === 0 ? "linux" : null;
  })();

  return windowing;
}

/**
 * The drawing `key` names, drawn once by `draw/draw.ts` under bun: a hooks module runs no
 * WebAssembly. The PNG goes to a file the window programs read too.
 */
function draw(
  $: EngineInterface,
  key: string,
  args: string[],
  stdin?: string,
): Promise<Drawn> {
  const done = drawings.get(key);

  if (done) return Promise.resolve(done);
  const running = pending.get(key);

  if (running) return running;
  const work = (async (): Promise<Drawn> => {
    try {
      const tmp = ((await $.env.get("TMPDIR")) ?? "/tmp").replace(/\/+$/, "");
      const out = `${tmp}/moo-hold-view/${key}.png`;
      const r = await $.process
        .run(["bun", `${$.plugin.root}/draw/draw.ts`, ...args, out], {
          stdin,
          timeoutMs: 30_000,
        })
        .catch((err: unknown) => {
          throw new Error(
            `could not run bun, which draws hold's pictures (https://bun.sh): ${messageOf(err)}`,
          );
        });

      if (r.exitCode !== 0)
        throw new Error(r.stderr.trim() || `draw.ts exited ${r.exitCode}`);
      const box = JSON.parse(r.stdout) as Box;
      const { base64 } = await $.fs.read(out, { as: "bytes" });

      return { png: base64, file: out, columns: box.columns, rows: box.rows };
    } catch (err) {
      return { error: messageOf(err) };
    }
  })().then((d) => {
    drawings.set(key, d);
    pending.delete(key);
    redraw($);

    return d;
  });

  pending.set(key, work);

  return work;
}

/** `box` shrunk as a whole to fit the room the transcript gives it. */
function fit(box: Box, viewport: RenderViewport | undefined): Box {
  const columns = Math.max(8, (viewport?.columns ?? 80) - 4);
  const rows = Math.max(6, Math.min(60, (viewport?.rows ?? 40) - 8));
  const s = Math.min(1, columns / box.columns, rows / box.rows);

  return {
    columns: Math.max(1, Math.floor(box.columns * s)),
    rows: Math.max(1, Math.floor(box.rows * s)),
  };
}

/**
 * Opens `file` in a borderless window by the pointer, or closes it when `key` has it open; the
 * program says `.` ten times a second, so the loop wakes to see a close and leaving it ends the
 * window. One that ends without saying `shown` opened none, which shows once.
 */
function toggleWindow($: EngineInterface, key: string, file: string) {
  const was = popover;

  if (was) was.isOpen = false;
  popover = undefined;
  redraw($);
  if (was?.key === key) return;
  const me = { key, isOpen: true };

  popover = me;
  void (async () => {
    const system = await windowOf($);
    const env = {
      IMAGE_PREVIEW_FILE: file,
      IMAGE_PREVIEW_SIZE: "800",
      IMAGE_PREVIEW_LIFE: "120",
    };
    let said = "";
    let isShown = false;

    try {
      if (!system)
        throw new Error("no window can open here (over ssh, or no desktop)");
      const argv =
        system === "macos"
          ? ["osascript", "-l", "JavaScript", "-e", MACOS]
          : ["python3", "-c", LINUX];

      for await (const { text } of $.process.spawn({ argv, env })) {
        if (said.length < 2000) said += text;
        if (/^shown$/m.test(text)) isShown = true;
        if (!me.isOpen) break;
      }
    } catch (err) {
      said += messageOf(err);
    }
    if (popover === me) popover = undefined;
    redraw($);
    if (!isShown && me.isOpen)
      failOnce(
        $,
        `the picture's window did not open: ${said.replace(/\.\n/g, "").trim().slice(0, 200) || "its program could not start"}`,
      );
  })();
}

/** A tool row with a [view] for each picture or markdown file its calls touched. */
async function withViews(
  $: EngineInterface,
  els: Elements["terminal"],
  e: { requestId: string; viewport?: RenderViewport },
  row: RenderElement,
  files: string[],
) {
  const { Box, Text, Markdown, Image, Button } = els;
  const pixels = await pixelsHere($, e.viewport);
  const buttons: RenderElement[] = [];
  const views: RenderElement[] = [];

  for (const path of files) {
    const id = `view-${e.requestId}-${path}`;
    const kind = kindOf(path)!;
    const name = files.length === 1 ? "" : ` ${nameOf(path)}`;
    const isWindow = kind === "picture" && !pixels;
    const isOpen = isWindow ? popover?.key === id : opened.has(id);

    buttons.push(
      <Button
        key={id}
        label={`${isOpen ? "fold" : "view"}${name}`}
        dimColor
        onPress={async () => {
          if (opened.delete(id)) return redraw($);
          try {
            if (kind === "markdown") {
              docs.set(id, cleanMarkdown(await $.fs.read(path)));
            } else {
              const stat = await $.fs.stat(path);
              const key = await hash(
                `picture\0${path}\0${stat.size}\0${stat.mtimeMs}`,
              );
              const d = await draw($, key, ["picture", path]);

              if ("error" in d) throw new Error(d.error);
              pictures.set(id, key);
              if (isWindow) return toggleWindow($, id, d.file);
            }
            opened.add(id);
          } catch (err) {
            failOnce($, `${nameOf(path)} has no view: ${messageOf(err)}`);
          }
          redraw($);
        }}
      />,
    );
    if (!opened.has(id)) continue;
    const doc = docs.get(id);
    const pic = drawings.get(pictures.get(id) ?? "");

    if (kind === "markdown" && doc && "text" in doc)
      views.push(
        <Box key={`v-${id}`} flexDirection="column">
          <Markdown text={doc.text} />
          {doc.isCut ? <Text dimColor>cut at 90000 characters</Text> : null}
        </Box>,
      );
    if (kind === "picture" && pic && "png" in pic) {
      const box = fit(pic, e.viewport);

      views.push(
        <Image
          key={`v-${id}`}
          source={{ png: pic.png }}
          columns={box.columns}
          rows={box.rows}
          alt={nameOf(path)}
        />,
      );
    }
  }

  return (
    <Box flexDirection="column">
      {row}
      <Box flexDirection="row" gap={1} paddingLeft={2}>
        {buttons}
      </Box>
      {views}
    </Box>
  );
}

const isDone = (c: {
  isRunning: boolean;
  isErrored: boolean;
  isInterrupted: boolean;
}) => !c.isRunning && !c.isErrored && !c.isInterrupted;

export const register: Register = (on) => {
  on("config.set", { key: "theme" }, async ($, e, next) => {
    const r = await next(e);

    theme = undefined;
    redraw($);

    return r;
  });

  // A closed Mermaid fence draws as its picture, in place; the rest of the reply as the reply draws.
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    if (!hasMermaid(e.props.text)) return next(e);
    try {
      const els = $.ui.resolve(e);

      if (!("Image" in els)) return next(e);
      const { Box, Text, Markdown, Image, Button } = els;
      const [t, pixels] = await Promise.all([
        themeOf($),
        pixelsHere($, e.viewport),
      ]);
      const window = pixels ? null : await windowOf($);
      const parts: RenderElement[] = [];
      // The engine's own drawing of the reply's first prose keeps the bullet that opens a reply.
      let lead: RenderElement | null = null;

      for (const [i, s] of segments(e.props.text).entries()) {
        if ("md" in s) {
          if (i === 0) lead = await next({ ...e, props: { ...e.props, text: s.md } });
          else parts.push(<Markdown key={`md-${i}`} text={s.md} />);
          continue;
        }
        if ("writing" in s) {
          parts.push(
            <Text
              key={`w-${i}`}
              dimColor
            >{`${altOf(s.writing)} (being written)`}</Text>,
          );
          continue;
        }
        const key = await hash(`mermaid\0${t}\0${s.mermaid}`);
        const d = drawings.get(key);
        const alt = altOf(s.mermaid);

        if (!d) {
          void draw($, key, ["mermaid", t], s.mermaid);
          parts.push(<Text key={`d-${i}`} dimColor>{`${alt} (drawing)`}</Text>);
          continue;
        }
        if ("error" in d) {
          failOnce(
            $,
            `a Mermaid diagram did not draw, so the reply shows its source: ${d.error}`,
          );

          return next(e);
        }
        const box = fit(d, e.viewport);
        const source = `source-${key}-${i}`;
        const open = `open-${key}-${i}`;

        parts.push(
          <Box key={`m-${i}`} flexDirection="column">
            {pixels ? (
              <Image
                source={{ png: d.png }}
                columns={box.columns}
                rows={box.rows}
                alt={alt}
              />
            ) : (
              <Text dimColor>{alt}</Text>
            )}
            <Box flexDirection="row" gap={1}>
              {window ? (
                <Button
                  key={open}
                  label={popover?.key === open ? "close" : "open"}
                  dimColor
                  onPress={() => toggleWindow($, open, d.file)}
                />
              ) : null}
              <Button
                key={source}
                label="source"
                dimColor
                onPress={() => {
                  if (!opened.delete(source)) opened.add(source);
                  redraw($);
                }}
              />
            </Box>
            {opened.has(source) ? (
              <Markdown text={`\`\`\`mermaid\n${s.mermaid}\n\`\`\``} />
            ) : null}
          </Box>,
        );
      }

      return (
        <Box flexDirection="column">
          {lead}
          <Box flexDirection="column" gap={1} marginTop={1} paddingLeft={2}>
            {parts}
          </Box>
        </Box>
      );
    } catch (err) {
      failOnce(
        $,
        `a reply with a Mermaid diagram draws as written: ${messageOf(err)}`,
      );

      return next(e);
    }
  });

  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    const files = isDone(e.props)
      ? viewable(e.props.tool, e.props.input, e.props.output)
      : [];

    if (!files.length) return next(e);
    const row = await next(e);
    const els = $.ui.resolve(e);

    if (!("Image" in els)) return row;
    try {
      return await withViews($, els, e, row, files);
    } catch (err) {
      failOnce($, `a tool row draws without [view]: ${messageOf(err)}`);

      return row;
    }
  });

  // Reads fold into one group line; its [view]s go under that line. Unfolded, each row has its own.
  on("ui.render", { component: "ToolGroup" }, async ($, e, next) => {
    const files = e.props.isExpanded
      ? []
      : [
          ...new Set(
            e.props.calls
              .filter(isDone)
              .flatMap((c) => viewable(c.tool, c.input, c.output)),
          ),
        ];

    if (!files.length) return next(e);
    const row = await next(e);
    const els = $.ui.resolve(e);

    if (!("Image" in els)) return row;
    try {
      return await withViews($, els, e, row, files);
    } catch (err) {
      failOnce($, `a tool row draws without [view]: ${messageOf(err)}`);

      return row;
    }
  });
};
