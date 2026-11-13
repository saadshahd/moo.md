/* The front band's fork: one job's questions, each a fork in a line.
   BandFork.astro draws the questions as panels of real buttons; this draws
   the line and conducts the loop.
   moo off: the amber line runs through every fork on the answer the agent
   proposes, never stops, and only that route is ever drawn; the panel shows
   what the agent did alone. moo on: the pine line runs to each fork and
   stops, both lanes show, the question and its two answers come back, and
   the cursor that is you walks up and waits. A pick, by click, tap, Enter,
   an arrow key or a hover held on a card, lands at once and hurries what is
   still moving; the panel shows what the pick does, the line takes that
   lane, and the other lane stays, not taken. After the last fork the panel
   lists the path taken. With no pick the proposed answer stands in after a
   pause, and with no pick at all the loop goes round again. Under reduced
   motion every stretch is drawn at once and the piece waits at the first
   fork. */
import { Clock, whileSeen } from "./clock";

type P = [number, number];
type Seg = { el: HTMLElement; base: string; length: number };
type Moving = { done: Promise<unknown>; hurry(): void };

const LINE_WIDTH = 6;
const CURSOR: P = [12, 24];
const DRAW_PX_PER_MS = 0.7;
const WALK_MS = 900;
const WALK_EASE = "cubic-bezier(0.77, 0, 0.175, 1)";
const BEATS = {
  idle: 400,
  alone: 1800,
  result: 1400,
  firstWait: 5000,
  wait: 3500,
  engagedWait: 9000,
  rest: 5000,
  reset: 350,
  leanRetry: 1000,
};
const KEY_TO_OPTION: Record<string, number> = {
  ArrowUp: 0,
  ArrowLeft: 0,
  ArrowDown: 1,
  ArrowRight: 1,
};

const dist = ([ax, ay]: P, [bx, by]: P) => Math.hypot(bx - ax, by - ay);
const at = ([x, y]: P) =>
  `translate(${x - CURSOR[0] / 2}px, ${y - CURSOR[1] / 2}px)`;
const scale = (s: Seg, n: number) => `${s.base} scaleX(${n})`;
const layer = (parent: Element, className: string) => {
  const el = document.createElement("div");
  el.className = className;
  parent.append(el);
  return el;
};

function segment(
  parent: Element,
  a: P,
  b: P,
  className: string,
  shown = 0,
): Seg {
  const el = layer(parent, `fork-seg ${className}`);
  el.style.width = `${dist(a, b) + LINE_WIDTH}px`;
  el.style.height = `${LINE_WIDTH}px`;
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const s = {
    el,
    base: `translate(${a[0]}px, ${a[1]}px) rotate(${angle}rad) translate(${-LINE_WIDTH / 2}px, ${-LINE_WIDTH / 2}px)`,
    length: dist(a, b),
  };
  el.style.transform = scale(s, shown);
  return s;
}
const stretch = (parent: Element, points: P[], className: string, shown = 0) =>
  points
    .slice(1)
    .map((b, i) => segment(parent, points[i], b, className, shown));

export function mount(fork: HTMLElement) {
  const path = fork.querySelector<HTMLElement>("[data-path]")!;
  const live = fork.querySelector<HTMLElement>("[data-live]")!;
  const panels = [...fork.querySelectorAll<HTMLElement>("[data-panel]")];
  const panel = (id: string | number) =>
    panels.find((p) => p.dataset.panel === String(id))!;
  const asks = panels.filter((p) => /^\d+$/.test(p.dataset.panel!));
  const proposed = asks.map((p) => Number(p.dataset.proposed));
  const n = asks.length;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clock = new Clock(fork);

  /* The line: a lead-in, then per fork two lanes that part and meet again,
     a link to the next fork, and a tail. The upper lane is the first answer.
     Every stretch is built hidden here; the loop only draws and fades. */
  let geo: {
    start: P;
    end: P;
    forkAt: P[];
    lanes: P[][][];
    links: Seg[][];
    pine: Seg[][][];
    ghosts: HTMLElement[][];
    tints: HTMLElement[][];
    tail: Seg[];
    amber: HTMLElement;
    cursor: HTMLElement;
  };
  const layout = () => {
    const w = path.clientWidth;
    const cy = path.clientHeight / 2;
    const rise = cy - LINE_WIDTH;
    const lead = w * 0.06;
    const gap = w * 0.05;
    const span = (w - lead - gap * (n - 1) - w * 0.08) / n;
    const dx = Math.min(rise, span * 0.22);
    const start: P = [0, cy];
    const forkAt: P[] = asks.map((_, k) => [lead + k * (span + gap), cy]);
    const meet = (k: number): P => [forkAt[k][0] + span, cy];
    const lanes = forkAt.map((a, k) =>
      [-1, 1].map((side): P[] => [
        a,
        [a[0] + dx, cy + side * rise],
        [meet(k)[0] - dx, cy + side * rise],
        meet(k),
      ]),
    );
    path.replaceChildren();
    const amber = layer(path, "fork-layer amber");
    const quiet = layer(path, "fork-layer");
    const pine = layer(path, "fork-layer");
    const overLanes = (className: string, segClass: string) =>
      lanes.map((pair) =>
        pair.map((pts) => {
          const g = layer(quiet, className);
          stretch(g, pts, segClass, 1);
          return g;
        }),
      );
    const cursor = layer(path, "fork-cursor");
    cursor.style.width = `${CURSOR[0]}px`;
    cursor.style.height = `${CURSOR[1]}px`;
    cursor.style.transform = at(start);
    geo = {
      start,
      end: [w, cy],
      forkAt,
      lanes,
      links: forkAt.map((a, k) =>
        stretch(pine, [k === 0 ? start : meet(k - 1), a], "pine"),
      ),
      pine: lanes.map((pair) => pair.map((pts) => stretch(pine, pts, "pine"))),
      ghosts: overLanes("fork-ghost", "ghost"),
      tints: overLanes("fork-tint", "pine"),
      tail: stretch(pine, [meet(n - 1), [w, cy]], "pine"),
      amber,
      cursor,
    };
  };

  /* Draws stretches one after another at the agent's pace. */
  const draw = (segs: Seg[]): Moving => {
    let current: Animation | null = null;
    let rushed = still;
    const done = (async () => {
      for (const s of segs) {
        if (rushed) {
          s.el.style.transform = scale(s, 1);
          continue;
        }
        current = clock.play(
          s.el,
          [{ transform: scale(s, 0) }, { transform: scale(s, 1) }],
          {
            duration: s.length / DRAW_PX_PER_MS,
          },
        );
        await current.finished.catch(() => {});
      }
    })();
    const hurry = () => {
      rushed = true;
      current?.finish();
    };
    return { done, hurry };
  };
  /* Moves the cursor through points at your pace. */
  const walk = (points: P[]): Moving => {
    const legs = points.map((p, i) => (i ? dist(points[i - 1], p) : 0));
    const total = legs.reduce((t, d) => t + d, 0) || 1;
    const offsets = legs.map(
      (_, i) => legs.slice(0, i + 1).reduce((t, d) => t + d, 0) / total,
    );
    const frames = points.map((p, i) => ({
      transform: at(p),
      offset: offsets[i],
    }));
    const a = clock.play(geo.cursor, frames, {
      duration: still ? 0 : WALK_MS,
      easing: WALK_EASE,
    });
    return {
      done: a.finished.catch(() => {}),
      hurry: () => a.updatePlaybackRate(5),
    };
  };
  const cursorAt = (): P => {
    const m = new DOMMatrix(getComputedStyle(geo.cursor).transform);
    return [m.m41 + CURSOR[0] / 2, m.m42 + CURSOR[1] / 2];
  };

  /* Shows one panel; focus inside the last one moves to the same place. */
  const show = (id: string | number) => {
    const from = panels.find((p) => p.contains(document.activeElement));
    const index = from
      ? [...from.querySelectorAll("button")].indexOf(
          document.activeElement as HTMLButtonElement,
        )
      : -1;
    for (const p of panels) {
      const on = p.dataset.panel === String(id);
      p.toggleAttribute("data-shown", on);
      if (p.dataset.panel !== "off") p.inert = !on;
    }
    if (from)
      (
        panel(id).querySelectorAll("button")[Math.max(index, 0)] ?? panel(id)
      ).focus({ preventScroll: true });
  };

  /* The fork waiting for a pick, and how to hurry what leads up to it. */
  let asking: { k: number; resolve(i: number): void; hurry(): void } | null =
    null;
  let leaning: HTMLElement | null = null;
  let engaged = false;
  const lean = (tint: HTMLElement | null) => {
    leaning?.removeAttribute("data-lean");
    leaning = tint;
    tint?.setAttribute("data-lean", "");
  };
  const pick = (k: number, i: number, by: "user" | "auto") => {
    if (asking?.k !== k) return;
    const { resolve, hurry } = asking;
    asking = null;
    lean(null);
    if (by === "user") engaged = true;
    const p = panel(k);
    p.dataset.pick = String(i);
    p.querySelectorAll<HTMLButtonElement>("[data-opt]").forEach((b, j) => {
      b.toggleAttribute("data-chosen", j === i);
      if (by === "user") b.setAttribute("aria-pressed", String(j === i));
    });
    fork.querySelector<HTMLElement>(`[data-row="${k}"]`)!.dataset.pick =
      String(i);
    if (by === "user")
      live.textContent = p
        .querySelector(`[data-result="${i}"]`)!
        .textContent!.trim();
    hurry();
    resolve(i);
  };
  const answer = (k: number, hurry: () => void) =>
    new Promise<number>((resolve) => {
      asking = { k, resolve, hurry };
      if (still) return;
      const wait = engaged
        ? BEATS.engagedWait
        : k === 0
          ? BEATS.firstWait
          : BEATS.wait;
      const tryAuto = () => {
        if (asking?.k !== k) return;
        if (leaning) clock.wait(BEATS.leanRetry).then(tryAuto);
        else pick(k, proposed[k], "auto");
      };
      clock.wait(wait).then(tryAuto);
    });

  asks.forEach((p, k) =>
    p.querySelectorAll<HTMLButtonElement>("[data-opt]").forEach((b, i) => {
      b.addEventListener("click", () => pick(k, i, "user"));
      b.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "mouse" && asking?.k === k) lean(geo.tints[k][i]);
      });
      b.addEventListener("pointerleave", () => {
        if (leaning === geo.tints[k][i]) lean(null);
      });
      b.addEventListener("keydown", (e) => {
        const to = KEY_TO_OPTION[e.key];
        if (to === undefined) return;
        e.preventDefault();
        p.querySelectorAll("button")[to].focus();
        pick(k, to, "user");
      });
    }),
  );
  /* A hover held until its lane fills picks that card. */
  path.addEventListener("transitionend", (e) => {
    if (e.propertyName !== "opacity" || e.target !== leaning) return;
    geo.tints.forEach((pair, k) =>
      pair.forEach((t, i) => t === leaning && pick(k, i, "user")),
    );
  });

  const reset = () => {
    for (const el of path.querySelectorAll<HTMLElement>("*"))
      el.getAnimations().forEach((a) => a.cancel());
    for (const s of [...geo.links.flat(), ...geo.pine.flat(2), ...geo.tail])
      s.el.style.transform = scale(s, 0);
    for (const g of geo.ghosts.flat()) g.removeAttribute("data-open");
    geo.amber.replaceChildren();
    geo.cursor.style.transform = at(geo.start);
    for (const p of panels) {
      delete p.dataset.pick;
      for (const b of p.querySelectorAll("[data-opt]")) {
        b.removeAttribute("data-chosen");
        b.setAttribute("aria-pressed", "false");
      }
    }
    fork
      .querySelectorAll<HTMLElement>("[data-row]")
      .forEach((r) => delete r.dataset.pick);
    delete fork.dataset.waiting;
  };

  let run = 0;
  const beat = async (mine: number, ms: number) => {
    await clock.wait(still ? 0 : ms);
    return mine === run;
  };
  /* One pass of the job; true when it should go round again. */
  async function cycle(mine: number) {
    reset();
    fork.dataset.phase = "off";
    show("off");
    if (!still) {
      if (!(await beat(mine, BEATS.idle))) return false;
      const route: P[] = [
        geo.start,
        ...geo.lanes.flatMap((pair, k) => pair[proposed[k]]),
        geo.end,
      ];
      await draw(stretch(geo.amber, route, "amber")).done;
      if (!(await beat(mine, BEATS.alone))) return false;
    }
    fork.dataset.phase = "on";
    for (let k = 0; k < n; k++) {
      show(k);
      const line = draw(geo.links[k]);
      const steps = walk([cursorAt(), geo.forkAt[k]]);
      line.done.then(() =>
        geo.ghosts[k].forEach((g) => g.setAttribute("data-open", "")),
      );
      const picked = answer(k, () => {
        line.hurry();
        steps.hurry();
      });
      steps.done.then(() => {
        if (asking?.k === k) fork.dataset.waiting = "";
      });
      const i = await picked;
      delete fork.dataset.waiting;
      await line.done;
      geo.ghosts[k][i].removeAttribute("data-open");
      const lane = draw(geo.pine[k][i]);
      await steps.done;
      walk(geo.lanes[k][i]);
      await lane.done;
      if (!(await beat(mine, BEATS.result))) return false;
    }
    show("end");
    await Promise.all([draw(geo.tail).done, walk([cursorAt(), geo.end]).done]);
    return !engaged && !still;
  }

  function start() {
    const mine = ++run;
    asking = null;
    (async () => {
      while (await cycle(mine)) {
        if (!(await beat(mine, BEATS.rest))) return;
        fork.dataset.reset = "";
        if (!(await beat(mine, BEATS.reset))) return;
        delete fork.dataset.reset;
      }
    })();
  }

  layout();
  whileSeen(fork, { pause: () => clock.pause(), resume: () => clock.resume() });
  new ResizeObserver(() => {
    if (Math.abs(path.clientWidth - geo.end[0]) < 1) return;
    layout();
    start();
  }).observe(path);
  start();
}
