import type { EngineInterface } from "claude-code";
import { failOnce, messageOf, redraw } from "./ui.ts";
import {
  LINUX,
  LINUX_POINTER,
  MACOS,
  MACOS_POINTER,
  MARKER,
  PAD,
} from "./window.ts";

export type Rect = { x: number; y: number; width: number; height: number };
/** The pointer and the room on its screen, from that screen's top left, in points. */
export type Pointer = { x: number; y: number; area: Rect; scale: number };

/** The window's longest side at most, in points. */
const LARGEST = 800;
/**
 * From the pointer to the window's near edge. The pointer is on the button's row, which is about
 * 16 points tall, so one row clears the button wherever on it the pointer sits, and 8 more leave a gap.
 */
const GAP = 24;
/** How long a window stays at most, whatever its program does. */
export const LIFE_MS = 120_000;

/**
 * Where the window for a picture `size` device pixels goes. A press gives no position, so the
 * pointer stands for the button: the window's left edge at the pointer, below it, or above it
 * when it does not fit below and there is more room above; shrunk to fit the side it is on.
 */
export function place(
  p: Pointer,
  size: { width: number; height: number },
): Rect {
  const { area } = p;
  const bottom = area.y + area.height;
  const below = bottom - (p.y + GAP);
  const above = p.y - GAP - area.y;
  const width = size.width / p.scale;
  const height = size.height / p.scale;
  const isBelow = height + PAD * 2 <= below || below >= above;
  const room = Math.max(1, (isBelow ? below : above) - PAD * 2);
  const s = Math.min(
    1,
    LARGEST / Math.max(width, height),
    room / height,
    (area.width - PAD * 2) / width,
  );
  const w = Math.max(1, Math.round(width * s)) + PAD * 2;
  const h = Math.max(1, Math.round(height * s)) + PAD * 2;

  return {
    x: Math.round(Math.max(area.x, Math.min(p.x, area.x + area.width - w))),
    y: Math.round(isBelow ? p.y + GAP : p.y - GAP - h),
    width: w,
    height: h,
  };
}

/** A PNG's size in pixels, read off the header of its base64; null for other bytes. */
export function pngSize(
  base64: string,
): { width: number; height: number } | null {
  const b = Uint8Array.from(atob(base64.slice(0, 32)), (c) => c.charCodeAt(0));
  const be32 = (i: number) =>
    ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;

  return b.length >= 24 && be32(0) === 0x89504e47 && be32(12) === 0x49484452
    ? { width: be32(16), height: be32(20) }
    : null;
}

let windowing: Promise<"macos" | "linux" | null> | undefined;

/** Which system's program opens a picture in a window; none over ssh. */
export function windowOf($: EngineInterface) {
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

// What a hot reload drops; the engine then ends the program, and the next open ends any left.
let shown: { key: string; close: () => void } | undefined;

/** Whether the window `key` opened is up. */
export const isWindowOpen = (key: string) => shown?.key === key;

/** Closes the window up, if any. */
export function closeWindow($: EngineInterface) {
  const was = shown;

  shown = undefined;
  if (!was) return;
  was.close();
  redraw($);
}

/** Opens the PNG `file` (`png` its base64) in a window under the pointer, or closes it when `key` has it open. */
export function toggleWindow(
  $: EngineInterface,
  key: string,
  file: string,
  png: string,
) {
  const was = shown?.key;

  closeWindow($);
  if (was === key) return;
  let close!: () => void;
  const closed = new Promise<null>((r) => (close = () => r(null)));
  const me = { key, close };

  shown = me;
  redraw($);
  void (async () => {
    let said = "";
    let isShown = false;
    let isClosed = false;
    const life = new AbortController();
    const ended = $.clock.sleep(LIFE_MS, { signal: life.signal }).then(
      () => null,
      () => null,
    );

    void closed.then(() => (isClosed = true));
    try {
      const system = await windowOf($);

      if (!system)
        throw new Error("no window can open here (over ssh, or no desktop)");
      const size = pngSize(png);

      if (!size) throw new Error("its picture is no PNG");
      const probe = await $.process.run(
        system === "macos"
          ? ["osascript", "-l", "JavaScript", "-e", MACOS_POINTER]
          : ["python3", "-c", LINUX_POINTER],
      );

      if (probe.exitCode !== 0)
        throw new Error(
          probe.stderr.trim() || "the pointer could not be found",
        );
      const r = place(JSON.parse(probe.stdout) as Pointer, size);
      // Closed while the pointer was read: the window open now is another's to keep.
      if (isClosed) return;
      // One window at a time, whichever session or load of this module opened the last.
      await $.process.run(["pkill", "-f", MARKER]).catch(() => undefined);
      if (isClosed) return;
      const stream = $.process.spawn({
        argv:
          system === "macos"
            ? ["osascript", "-l", "JavaScript", "-e", MACOS]
            : ["python3", "-c", LINUX],
        env: {
          HOLD_WINDOW_FILE: file,
          HOLD_WINDOW_RECT: `${r.x} ${r.y} ${r.width} ${r.height}`,
          HOLD_WINDOW_LIFE: String(LIFE_MS / 1000),
        },
      });

      try {
        // A close or the end of the window's life wins over a program that has gone quiet.
        for (;;) {
          const piece = await Promise.race([stream.next(), closed, ended]);

          if (piece === null || piece.done) break;
          if (said.length < 2000) said += piece.value.text;
          if (/^shown$/m.test(piece.value.text)) isShown = true;
        }
      } finally {
        // Ends the program, whatever it is doing.
        void stream.return(undefined as never).catch(() => undefined);
      }
    } catch (err) {
      said += messageOf(err);
    } finally {
      life.abort();
      if (shown === me) shown = undefined;
      redraw($);
    }
    if (!isShown && !isClosed)
      failOnce(
        $,
        `the picture's window did not open: ${said.replace(/\.\n/g, "").trim().slice(0, 200) || "its program could not start"}`,
      );
  })();
}
