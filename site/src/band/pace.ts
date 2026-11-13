/* hum's band piece: two paces, the agent's and the checks', with you away.
   moo off: amber lines pour out faster than anyone could read and scroll
   past; nothing checks them, and the reply the agent gave alone stands under
   them. moo on: the agent writes its lines; the repo's checks settle them one
   by one and each turns pine; one line nothing settles stays open. Only then
   does the cursor that is you come back, to that line, and the question the
   run left for you shows with its two answers; the cursor waits, picks the
   one the session's user picked, and the last line settles. BandPace.astro
   draws the words; this draws the lines and plays the loop. */
import { EASE } from "./clock";
import { loop, node, space, tracker, type Score } from "./loop";

/* Lines of code as bars: an indent, then each token's share of the width. */
const CODE: number[][] = [
  [0, 0.17, 0.32, 0.06],
  [1, 0.15, 0.1, 0.39],
  [1, 0.23, 0.49],
  [2, 0.13, 0.29],
  [2, 0.43, 0.13],
  [1, 0.05],
  [1, 0.2, 0.13, 0.24],
  [0, 0.05],
];
const BAR = 8;
const CURSOR = { w: 12, h: 24 };
const OFF_LINES = 28;
const AT = {
  off: 400,
  offEach: 60,
  offEnd: 3400,
  on: 3900,
  onEach: 140,
  checks: 5200,
  checkEach: 320,
  ask: 7000,
  pick: 9400,
  fade: 12400,
  length: 12900,
  still: 10600,
};

const sx = (s: number) => ({ transform: `scaleX(${s})` });
const ty = (y: number) => ({ transform: `translateY(${y}px)` });
const seen = (o: number) => ({ opacity: o });

export function mount(pace: HTMLElement) {
  const sheet = pace.querySelector<HTMLElement>("[data-sheet]")!;
  const one = (selector: string) => pace.querySelector<HTMLElement>(selector)!;
  const labels = {
    off: one('[data-label="off"]'),
    on: one('[data-label="on"]'),
  };
  const panels = {
    off: one('[data-panel="off"]'),
    on: one('[data-panel="on"]'),
  };
  const answers = [...pace.querySelectorAll<HTMLElement>("[data-answer]")];
  const picked = Number(one("[data-picked]").dataset.picked);

  const draw = (): Score => {
    sheet.replaceChildren();
    const { tracks, track } = tracker();
    const pitch =
      parseFloat(getComputedStyle(pace).getPropertyValue("--piece-line")) *
      space(4);
    const rows = Math.floor(sheet.clientHeight / pitch);
    const open = rows - 2;
    const block = { w: 0.375 * space(4), h: 0.75 * space(4) };
    const textAt = block.w + space(2);
    const width = sheet.clientWidth - textAt;
    const indent = space(5);

    const line = (
      parent: Element,
      slot: number,
      [depth, ...tokens]: number[],
      tone: string,
    ) => {
      const row = node(parent, `pace-row ${tone}`, {
        x: textAt + depth * indent,
        y: slot * pitch + (pitch - BAR) / 2,
        h: BAR,
      });
      for (const share of tokens) node(row, "", { w: share * width }, "span");
      return row;
    };

    /* moo off: line after line at the agent's pace; past the sheet's last
       row the column scrolls so the newest line stays in view. */
    const offCol = node(sheet, "pace-col", { x: 0, y: 0 });
    for (let i = 0; i < OFF_LINES; i++) {
      const at = AT.off + i * AT.offEach;
      track(line(offCol, i, CODE[i % CODE.length], "amber"), sx(0))
        .move(at, at + 120, sx(1), EASE.out)
        .jump(AT.offEnd + 300, sx(0));
    }
    track(offCol, { ...ty(0), ...seen(1) })
      .move(
        AT.off + rows * AT.offEach,
        AT.off + (OFF_LINES - 1) * AT.offEach,
        ty(-(OFF_LINES - rows) * pitch),
        "linear",
      )
      .move(AT.offEnd, AT.offEnd + 300, seen(0), EASE.out)
      .jump(AT.offEnd + 300, { ...ty(0), ...seen(1) });

    /* moo on: the agent writes its lines, then the checks settle all but
       one, which waits for you. */
    const onCol = node(sheet, "pace-col", { x: 0, y: 0 });
    const settle = (slot: number, at: number) => {
      const own = track(
        line(onCol, slot, CODE[slot % CODE.length], "own"),
        seen(0),
      ).move(at, at + 200, seen(1), EASE.out);
      const check = track(
        node(onCol, "pace-check", {
          x: 0,
          y: slot * pitch + (pitch - block.h) / 2,
          ...block,
        }),
        seen(0),
      ).move(at, at + 200, seen(1), EASE.out);
      return { own, check };
    };
    for (let k = 0; k < rows; k++) {
      const at = AT.on + k * AT.onEach;
      track(line(onCol, k, CODE[k % CODE.length], "draft"), sx(0)).move(
        at,
        at + 160,
        sx(1),
        EASE.out,
      );
      if (k !== open) settle(k, AT.checks + k * AT.checkEach);
    }
    const waiting = AT.checks + open * AT.checkEach;
    track(
      node(onCol, "pace-check open", {
        x: 0,
        y: open * pitch + (pitch - block.h) / 2,
        ...block,
      }),
      seen(0),
    ).move(waiting, waiting + 200, seen(1), EASE.out);
    settle(open, AT.pick);

    const cursor = track(
      node(onCol, "band-cursor", {
        x: 0,
        y: open * pitch + (pitch - CURSOR.h) / 2,
        w: CURSOR.w,
        h: CURSOR.h,
      }),
      seen(0),
    ).move(AT.ask, AT.ask + 200, seen(1), EASE.out);
    for (let k = 0; k < 2; k++) {
      const t = AT.ask + 600 + k * 900;
      cursor
        .move(t, t + 60, seen(0.15), "linear")
        .move(t + 420, t + 480, seen(1), "linear");
    }
    cursor.move(AT.pick, AT.pick + 200, seen(0), EASE.out);
    track(onCol, seen(1)).move(AT.fade, AT.fade + 300, seen(0), EASE.out);

    track(panels.off, seen(1))
      .move(AT.offEnd, AT.offEnd + 300, seen(0), EASE.out)
      .move(AT.fade, AT.fade + 300, seen(1), EASE.out);
    track(panels.on, seen(0))
      .move(AT.ask, AT.ask + 300, seen(1), EASE.out)
      .move(AT.fade, AT.fade + 300, seen(0), EASE.out);
    answers.forEach((a, i) => {
      track(a.querySelector("[data-pine]")!, seen(0)).move(
        AT.pick,
        AT.pick + 200,
        seen(i === picked ? 1 : 0),
        EASE.out,
      );
      track(a, seen(1)).move(
        AT.pick,
        AT.pick + 200,
        seen(i === picked ? 1 : 0.55),
        EASE.out,
      );
    });
    track(labels.off, seen(1))
      .move(AT.offEnd + 100, AT.offEnd + 400, seen(0), EASE.out)
      .move(AT.fade, AT.fade + 300, seen(1), EASE.out);
    track(labels.on, seen(0))
      .move(AT.offEnd + 100, AT.offEnd + 400, seen(1), EASE.out)
      .move(AT.fade, AT.fade + 300, seen(0), EASE.out);

    return { tracks, length: AT.length, still: AT.still };
  };

  loop(pace, sheet, draw);
}
