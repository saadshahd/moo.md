// Plays a demo's pair once while it is in view, on one clock `t`: the moo-off
// pane plays first, then stands; the moo-on pane waits blank, then plays. A
// player's controls sit under both: play and pause, replay once it ends, a
// timeline in two parts, off and on, with a tick at each wait, and speed.
// Where the two panes don't fit side by side, one frame shows the pane whose
// part is playing, under tabs that name both. Each pane scrolls back like a
// terminal; the reader can pick a dialog's option. Under reduced motion, the
// timeline steps through one still per wait instead. Demo.astro picks the
// column count both panes draw at, one of COLS, as the page's width allows,
// and their height, as the screen's allows; the player draws the rows that
// height holds, and redraws at a new size without moving the clock.
import { COLS, frame, PANE, phases, waits, type Frame, type Row, type Seg, type Wait } from "./render";
import { currentSpeed, followSpeed, pickSpeed } from "./speed";
import type { Pair, Scene } from "./types";



// Quadrants per block glyph: upper-left, upper-right, lower-left, lower-right.
const QUADS: Record<string, string> = {
  "█": "1111",
  "▐": "0101",
  "▛": "1110",
  "▜": "1101",
  "▝": "0100",
  "▀": "1100",
};
/** The logo's rows, "glyphs|black" each and "/" between, as one picture in
 * quadrant units, cropped to what it draws so the CSS can size it in whole
 * pixels. */
function logoSvg(cell: string): string {
  const rows = cell.split("/").map((r) => r.split("|"));
  const quads = rows.flatMap(([glyphs], y) =>
    [...glyphs].flatMap((g, x) =>
      [...(QUADS[g] ?? "0000")].flatMap((on, q) => (on === "1" ? [[2 * x + (q % 2), 2 * y + (q >> 1)]] : [])),
    ),
  );
  const xs = quads.map(([x]) => x);
  const ys = quads.map(([, y]) => y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const black = rows.flatMap(([, k], y) =>
    [...k].flatMap((c, x) => (c === "k" ? [`<rect class="eye" x="${2 * x}" y="${2 * y}" width="2" height="2"/>`] : [])),
  );
  const orange = quads.map(([x, y]) => `<rect class="body" x="${x}" y="${y}" width="1" height="1"/>`);
  const [w, h] = [Math.max(...xs) + 1 - x0, Math.max(...ys) + 1 - y0];
  return `<svg class="logo" style="--w:${w};--h:${h}" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="none" shape-rendering="crispEdges">${[...black, ...orange].join("")}</svg>`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// A terminal draws box lines to the edges of each cell, so they join across
// rows at any line height: each becomes a cell whose arms Demo.astro draws,
// a run of ─ one wide cell. A glyph Fira Code's subsets lack sits in one cell.
const ARMS: Record<string, string> = {
  "─": "l r", "│": "u d", "┌": "d r", "┐": "d l", "└": "u r", "┘": "u l",
  "├": "u d r", "┤": "u d l", "┬": "d l r", "┴": "u l r", "┼": "u d l r",
  "╭": "a d r", "╮": "a d l", "╰": "a u r", "╯": "a u l",
};
const CELLS =
  /─+|[│┌┐└┘├┤┬┴┼╭╮╰╯]|[^\u0000-\u00ff\u2000-\u206f\u20ac\u2122\u2191\u2193\u2212\u2215\u23b8-\u23bd\u2500-\u259f]/gu;
const cells = (s: string) =>
  esc(s).replace(CELLS, (m) =>
    ARMS[m[0]]
      ? `<span class="bx ${ARMS[m[0]]}"><i>${m}</i></span>`
      : `<span class="gl">${m}</span>`,
  );
const segHtml = ([x, c]: Seg) =>
  c === "logo"
    ? logoSvg(x)
    : c
      ? `<span class="${c}">${cells(x)}</span>`
      : cells(x);
/** A row's segments; a run of them that acts the same is one of tend's
 * buttons, and a chip says whether its pane is open. */
function segsHtml(segs: Seg[]) {
  const out: string[] = [];
  for (let k = 0; k < segs.length; ) {
    const act = segs[k][2];
    if (!act) {
      out.push(segHtml(segs[k++]));
      continue;
    }
    const run: Seg[] = [];
    while (k < segs.length && segs[k][2] === act) run.push(segs[k++]);
    const open = act.startsWith("chip:") ? ` aria-expanded="${run.some(([x]) => x.includes("▴"))}"` : "";
    out.push(`<button type="button" class="act" data-act="${act}"${open}>${run.map(segHtml).join("")}</button>`);
  }
  return out.join("");
}
/** A row; an option's rows carry its index, and its first row is the one a
 * listbox names as the option. */
const rowHtml = (r: Row, id = "", first = false) =>
  `<div class="row ${r.cls ?? ""}"${r.opt === undefined ? "" : ` data-opt="${r.opt}"`}${first ? ` id="${id}-opt-${r.opt}" role="option"` : ""}>${segsHtml(r.segs)}</div>`;
const optionRows = (rows: Row[], id: string, cursor: number) =>
  rows
    .map((r, k) => {
      const first = r.opt !== undefined && rows.findIndex((x) => x.opt === r.opt) === k;
      return rowHtml(r, id, first).replace('role="option"', `role="option" aria-selected="${r.opt === cursor}"`);
    })
    .join("");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
let demos = 0;

const SIDES = ["off", "on"] as const;
type Side = (typeof SIDES)[number];
const LABEL: Record<Side, string> = { off: "moo off", on: "moo on" };

/** A wait on the pair's clock, and what it marks, for a screen reader. */
type Mark = { at: number; side: Side; what: string };
const what = (scene: Scene, w: Wait) =>
  w.on === "dialog" ? `question "${scene.turns[w.turn].dialogs![w.d].questions[w.q].header}"` : "reply";

export function mount(root: HTMLElement) {
  const pair = JSON.parse(root.dataset.demo!) as Pair;
  const $ = <T extends HTMLElement>(k: string, within: ParentNode = root) => within.querySelector<T>(`[data-${k}]`)!;
  const id = `demo${++demos}`;
  // The rows a pane's height holds, PANE.rows at least: Demo.astro sizes
  // both to the screen. The pane a tab hides has no height.
  const fitted = () => {
    const term = [...root.querySelectorAll<HTMLElement>("[data-term]")].find((x) => x.offsetHeight)!;
    const cs = getComputedStyle(term);
    const inner = term.getBoundingClientRect().height - [cs.paddingTop, cs.paddingBottom, cs.borderTopWidth, cs.borderBottomWidth].reduce((n, x) => n + parseFloat(x), 0);
    return Math.max(PANE.rows, Math.floor(inner / parseFloat(cs.lineHeight) + 1e-6));
  };
  let rows = fitted();
  // The count Demo.astro picked for the page's width.
  const picked = () => {
    const c = Number(getComputedStyle($("pair")).getPropertyValue("--cols"));
    if (!(COLS as readonly number[]).includes(c)) throw new Error(`a pane draws at ${c} columns, not one of ${COLS.join(", ")}`);
    return c;
  };
  let cols = picked();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // The moo-off part comes first on the clock; a pane with no turn has none.
  const lengths = SIDES.map((side) => (pair[side].turns.length ? phases(pair[side]).length : 0));
  const starts: Record<Side, number> = { off: 0, on: lengths[0] };
  const length = lengths[0] + lengths[1];
  const marks: Mark[] = SIDES.flatMap((side) =>
    pair[side].turns.length
      ? waits(pair[side]).map((w) => ({ at: starts[side] + w.at, side, what: what(pair[side], w) }))
      : [],
  );
  const sideAt = (s: number): Side => (s < starts.on ? "off" : "on");

  const playBtn = $<HTMLButtonElement>("play");
  // Speeds are the speed group's buttons, each naming its own.
  const speedBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-speed]")];
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const nowEl = $("now");
  const knob = $("knob");
  $("total").textContent = clock(length);
  const track = $("track");
  const fill = $("fill");
  const rail = $("rail");
  const probe = $("probe");

  let t = 0;
  let last = 0;
  let speed = currentSpeed();
  let still = 0; // the still on screen under reduced motion: a wait's index
  let inView = false;
  let userPaused = false;
  let pick: number | undefined; // the option the reader put the cursor on
  let tend: string | undefined; // the chip whose pane the reader opened
  let refocus: string | undefined; // the button keys pressed, to keep focus on through a redraw
  let ticking = false;
  let jumped = true;

  const now = () => (motion.matches ? (marks[still]?.at ?? 0) : t);

  /** One terminal: it draws its scene at the pair's clock, from its part's start. */
  function pane(side: Side) {
    const box = $(`side="${side}"`);
    const term = $("term", box);
    const scroll = $("scroll", box);
    const bottom = $("bottom", box);
    const toast = $("toast", box);
    const caret = $("caret", box);
    const trail = $("trail", box);
    const keycaps = $("keys", box);
    const scene = pair[side];
    const oid = `${id}-${side}`;
    let html = ["", "", ""];
    let f: Frame | undefined;
    let following = true; // false while the reader has scrolled away to read
    let stand = 0; // where the scroll stands: the bottom, or the reply's first row
    let replyTop: number | undefined; // where the reply's first row starts, if one is in

    // A fade at the top says there is more above, unless the reply's first
    // row is the top row.
    const fade = () =>
      scroll.classList.toggle("above", scroll.scrollTop > 0 && !(replyTop !== undefined && Math.abs(scroll.scrollTop - replyTop) <= 1));

    // Where the scroll stands: the newest line, the way a terminal follows
    // it, until the reply's first row reaches the top, where a waiting pane
    // holds it, unless the reader scrolled away.
    function place() {
      const end = scroll.scrollHeight - scroll.clientHeight;
      const top = f?.top === undefined ? undefined : (scroll.children[f.top] as HTMLElement | undefined);
      replyTop = top?.offsetTop;
      stand = Math.min(end, replyTop ?? end);
      if (following && Math.abs(scroll.scrollTop - stand) > 1) scroll.scrollTop = stand;
      fade();
    }

    function paint(s: number) {
      const at = s - starts[side];
      // Before its part, and with no turn at all, the pane stands blank.
      if (at < 0 || !scene.turns.length) {
        f = undefined;
        if (html.some(Boolean)) [scroll.innerHTML, bottom.innerHTML, toast.innerHTML, keycaps.innerHTML] = ["", "", "", ""];
        html = ["", "", ""];
        caret.hidden = trail.hidden = true;
        return;
      }
      // The reader's pick and tend's pane belong to the pane playing.
      const playing = side === sideAt(s);
      f = frame(scene, at, cols, playing ? pick : undefined, rows, playing ? tend : undefined);
      // tend's pane closes with its chip.
      if (playing && tend && !f.chips.includes(tend)) {
        tend = undefined;
        f = frame(scene, at, cols, pick, rows);
      }
      const next = [
        f.transcript.map((r) => rowHtml(r)).join(""),
        f.asking ? optionRows(f.bottom, oid, f.asking.cursor) : f.bottom.map((r) => rowHtml(r)).join(""),
        f.toast ? `<div class="box">${f.toast.rows.map((r) => rowHtml(r)).join("")}</div>` : "",
      ];
      if (next[0] !== html[0]) scroll.innerHTML = next[0];
      if (next[1] !== html[1]) {
        bottom.innerHTML = next[1];
        if (refocus) bottom.querySelector<HTMLElement>(`[data-act="${refocus}"]`)?.focus();
        refocus = undefined;
      }
      if (next[2] !== html[2]) toast.innerHTML = next[2];
      html = next;
      // A dialog's options are a listbox the arrow keys move through.
      if (f.asking) {
        bottom.setAttribute("role", "listbox");
        bottom.setAttribute("aria-label", "Options");
        bottom.setAttribute("aria-activedescendant", `${oid}-opt-${f.asking.cursor}`);
      } else ["role", "aria-label", "aria-activedescendant"].forEach((a) => bottom.removeAttribute(a));
      // Sliding in from the right edge, the box's left part shows first.
      const tbox = toast.firstElementChild as HTMLElement | null;
      if (tbox) tbox.style.transform = `translateX(${(1 - f.toast!.slide) * 100}%)`;
      // Keys fade in and out with the clock, so a still shows none.
      keycaps.innerHTML = motion.matches
        ? ""
        : f.keys.map((k) => `<kbd style="opacity:${k.fade}">${esc(k.label)}</kbd>`).join("");
      place();
      placeCaret();
      placeKeys();
    }

    // Keycaps sit just above the first row with text at the bottom: the prompt
    // box, or the slash menu over it, or the dialog. They may
    // cover the transcript, never what the reader picks from; a dialog that
    // fills the terminal pushes them to its top edge.
    function placeKeys() {
      if (!keycaps.childElementCount) return;
      const first = [...bottom.children].find((r) => r.textContent!.trim()) ?? bottom;
      const r = term.getBoundingClientRect();
      const top = first.getBoundingClientRect().top - r.top - keycaps.offsetHeight - 4;
      keycaps.style.top = `${Math.max(parseFloat(getComputedStyle(term).paddingTop), top)}px`;
    }

    // The cursor glides to its cell, leaving a short smear, and blinks softly
    // once at rest; it inverts the text under it, so it covers none.
    let at = "";
    let rest: number | undefined;
    let hue = 0;
    function placeCaret() {
      const c = f?.cursor;
      const row = c && (bottom.children[c.row] as HTMLElement | undefined);
      caret.hidden = trail.hidden = !row;
      if (!row || !c) return;
      const r0 = term.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      const cell = probe.firstElementChild!.getBoundingClientRect().width / 10;
      const x = r.left - r0.left + c.col * cell;
      const y = r.top - r0.top;
      const key = `${x},${y}`;
      if (key === at) return;
      const [px, py] = at ? at.split(",").map(Number) : [x, y];
      at = key;
      caret.style.transform = `translate(${x}px, ${y}px)`;
      caret.classList.remove("rest");
      clearTimeout(rest);
      rest = window.setTimeout(() => caret.classList.add("rest"), 700);
      // The glide and the smear's fade keep pace with the playback speed.
      term.style.setProperty("--glide", `${90 / speed}ms`);
      term.style.setProperty("--decay", `${280 / speed}ms`);
      // A jump (a seek, a scrub, a resize) moves the cursor with no glide or smear.
      if (jumped || (px === x && py === y)) {
        trail.classList.remove("hot");
        caret.style.transition = "none";
        requestAnimationFrame(() => (caret.style.transition = ""));
        return;
      }
      // The smear: on the row the cursor lands on, from it back toward where it
      // came from, at most 6 cells, behind the text. Each move takes the next hue,
      // so a run of moves cycles through them; it fades into the cursor's own
      // colour, and at rest only the plain cursor stays.
      const run = Math.min(Math.max(Math.abs(x - px), cell), 6 * cell);
      const back = py === y ? Math.sign(px - x) : y > py ? -1 : 1;
      hue = (hue + 47) % 360;
      trail.style.transition = "none";
      trail.style.transform = `translate(${back < 0 ? x - run : x + cell}px, ${y}px)`;
      trail.style.width = `${run}px`;
      trail.style.height = `${r.height}px`;
      trail.style.setProperty("--hue", String(hue));
      trail.classList.add("hot");
      void trail.offsetWidth; // start the fade from the hue
      trail.style.transition = "";
      trail.classList.remove("hot");
    }

    // Scrolling away from where the pane stands pauses the demo while this
    // pane plays, so the text holds still; back there, it resumes. Only
    // scrolls that follow the reader's own input count.
    let lastInput = -Infinity;
    for (const type of ["wheel", "touchmove", "keydown", "pointerdown"])
      scroll.addEventListener(type, () => (lastInput = performance.now()), { passive: true });
    scroll.addEventListener("scroll", () => {
      fade();
      if (motion.matches || performance.now() - lastInput > 800) return;
      const there = Math.abs(scroll.scrollTop - stand) <= 2;
      if (there !== following) {
        following = there;
        sync();
      }
    });

    // A click on the terminal plays or pauses it, as on a video, unless it picks
    // a dialog's option, ends a drag that scrolled, or ends selecting text.
    let down: { x: number; y: number; top: number } | undefined;
    term.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY, top: scroll.scrollTop }));
    term.addEventListener("click", (e) => {
      const moved = down && (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4 || scroll.scrollTop !== down.top);
      if (motion.matches || moved || getSelection()?.toString() || (e.target as HTMLElement).closest("[data-opt], [data-act], .pane")) return;
      playBtn.click();
    });
    bottom.addEventListener("click", (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>("[data-opt]");
      if (row) choose(Number(row.dataset.opt));
      const button = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (button) act(button.dataset.act!, e.detail === 0);
    });

    return {
      box,
      paint,
      asking: () => f?.asking,
      contains: (n: Node) => bottom.contains(n),
      following: () => following,
      follow: () => (following = true),
    };
  }
  const panes = SIDES.map(pane);
  const playing = () => panes[SIDES.indexOf(sideAt(now()))];

  // A tick on the timeline per wait: a mark, not a target of its own, since
  // waits can sit closer than a finger. The timeline is the target, and the
  // arrow keys go from wait to wait.
  const ticks = marks.map(() => {
    const tick = document.createElement("span");
    tick.className = "tick";
    track.append(tick);
    return tick;
  });
  const tickAt = (k: number) => (motion.matches ? k / Math.max(1, marks.length - 1) : marks[k].at / length);
  // Where the moo-on part starts on the rail: at its start, or under reduced
  // motion, at its first still.
  const onFrom = () => {
    if (!motion.matches) return starts.on / length;
    const k = marks.findIndex((m) => m.side === "on");
    return k <= 0 ? 0 : tickAt(k);
  };
  function placeTicks() {
    ticks.forEach((tick, k) => (tick.style.left = `${tickAt(k) * 100}%`));
    // The fill turns from moo off's colour to moo on's where its part starts
    // (chrome.css), and the rail parts there.
    const x = onFrom() * 100;
    fill.style.setProperty("--moo-from", `${x}%`);
    rail.style.maskImage =
      x > 0 && x < 100
        ? `linear-gradient(to right, #000 calc(${x}% - 1.5px), transparent calc(${x}% - 1.5px) calc(${x}% + 1.5px), #000 calc(${x}% + 1.5px))`
        : "";
  }

  function paint() {
    const reduced = motion.matches;
    root.classList.toggle("reduced", reduced);
    const s = now();
    const side = sideAt(s);
    // Where one frame holds one pane, it shows the one playing, and its tab is on.
    root.dataset.shown = side;
    tabs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === side)));
    panes.forEach((p) => p.paint(s));
    jumped = false;
    // The fill, its knob and the time readout show where the demo is.
    const at = `${(reduced ? still / Math.max(1, marks.length - 1) : t / length) * 100}%`;
    fill.style.clipPath = `inset(0 calc(100% - ${at}) 0 0)`;
    knob.style.left = at;
    nowEl.textContent = clock(s);
    const mark = marks.findLast((m) => m.at <= s);
    const said = mark ? `${LABEL[mark.side]}, ${mark.what}` : LABEL[side];
    if (reduced) {
      track.setAttribute("aria-valuenow", String(still + 1));
      track.setAttribute("aria-valuetext", said);
    } else {
      track.setAttribute("aria-valuenow", String(Math.floor(t)));
      track.setAttribute("aria-valuetext", `${clock(t)} of ${clock(length)}: ${said}`);
    }
  }

  const ended = () => t >= length;
  const running = () => inView && !userPaused && playing().following() && !motion.matches && !ended();

  // A frame that fails to draw says so in the pane playing, and the demo stops.
  function draw() {
    try {
      paint();
    } catch (e) {
      userPaused = true;
      $("scroll", playing().box).innerHTML = `<div class="row"><span class="o">This demo failed to draw: ${esc(String(e))}</span></div>`;
      throw e;
    }
  }

  function tick(at: number) {
    if (!running()) {
      ticking = false;
      return;
    }
    // A frame's timestamp can precede the performance.now() taken when play began.
    t = Math.min(length, t + (Math.max(0, at - last) / 1000) * speed);
    last = at;
    // At the end the demo holds its last frame, and play becomes replay.
    if (ended()) sync();
    else draw();
    requestAnimationFrame(tick);
  }

  function sync() {
    const paused = userPaused || !playing().following();
    playBtn.textContent = ended() ? "↻" : paused ? "▶" : "❚❚";
    playBtn.setAttribute("aria-label", ended() ? "Replay demo" : paused ? "Play demo" : "Pause demo");
    speedBtns.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === speed)));
    placeTicks();
    track.setAttribute("aria-valuemax", String(motion.matches ? marks.length : Math.floor(length)));
    track.setAttribute("aria-valuemin", motion.matches ? "1" : "0");
    if (running() && !ticking) {
      ticking = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
    draw();
  }

  /** Back to where each pane stands, the demo driving the dialog. */
  function release() {
    pick = undefined;
    tend = undefined;
    panes.forEach((p) => p.follow());
  }

  /** Jump to time `s`; a reader's pick no longer applies. Playing stays playing. */
  function seek(s: number) {
    jumped = true;
    t = Math.min(Math.max(0, s), length);
    release();
    last = performance.now();
    // A seek can end the demo or take it back from its end.
    sync();
  }
  function seekWait(k: number) {
    const to = Math.min(Math.max(0, k), marks.length - 1);
    if (motion.matches) {
      still = to;
      jumped = true;
      release();
      draw();
    } else seek(marks[to].at);
  }

  // Play always returns to where the panes stand and lets the demo drive the
  // dialog; at the end, it replays from the first ask.
  // The glyph of the state play or pause just put the demo in, shown in the
  // pair's centre, then faded.
  const flash = $("flash");
  function flashState() {
    flash.textContent = userPaused ? "❚❚" : "▶";
    flash.classList.remove("on");
    void flash.offsetWidth; // restart the fade
    flash.classList.add("on");
  }
  playBtn.addEventListener("click", () => {
    if (ended()) {
      seek(0);
      userPaused = false;
    } else if (userPaused || !playing().following()) {
      userPaused = false;
      release();
    } else userPaused = true;
    sync();
    flashState();
  });

  // A tab goes to the start of its pane's part.
  tabs.forEach((b) =>
    b.addEventListener("click", () => {
      const side = b.dataset.tab as Side;
      if (motion.matches) seekWait(marks.findIndex((m) => m.side === side));
      else seek(starts[side]);
    }),
  );

  // A speed picked here, or in another player, plays here too (speed.ts).
  speedBtns.forEach((b) => b.addEventListener("click", () => pickSpeed(Number(b.dataset.speed))));
  followSpeed((x) => {
    speed = x;
    sync();
  });

  // The timeline seeks where it is pressed, and follows a drag; a press within
  // half a fingertip (12px) of a tick goes to that wait.
  const seekTo = (e: PointerEvent) => {
    const r = track.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const near = ticks
      .map((_, k) => ({ k, d: Math.abs(tickAt(k) - x) * r.width }))
      .filter(({ d }) => d <= 12)
      .sort((a, b) => a.d - b.d)[0];
    if (near) seekWait(near.k);
    else if (motion.matches) seekWait(Math.round(x * (marks.length - 1)));
    else seek(x * length);
  };
  track.addEventListener("pointerdown", (e) => {
    track.setPointerCapture(e.pointerId);
    seekTo(e);
  });
  track.addEventListener("pointermove", (e) => {
    if (track.hasPointerCapture(e.pointerId)) seekTo(e);
  });

  // Picking an option pauses the demo and moves the dialog's cursor to it.
  function choose(k: number) {
    const asking = playing().asking();
    if (!asking) return;
    pick = Math.min(Math.max(0, k), asking.options - 1);
    userPaused = true;
    sync();
  }
  // tend's chip opens its pane, or closes it if open; close closes it. The
  // pane opens paused, as picking an option is, so it holds still to read;
  // play closes it and goes on. A press by key keeps the focus on what it
  // pressed, or on the chip once its pane closes.
  function act(name: string, byKey: boolean) {
    const chip = name.replace(/^chip:/, "");
    const closing = name === "close" || chip === tend;
    const was = `chip:${tend ?? chip}`;
    tend = closing ? undefined : chip;
    if (tend) userPaused = true;
    refocus = byKey ? (closing ? was : name) : undefined;
    sync();
  }

  // Keys: Space plays or pauses, ←/→ go to the previous or next wait, ↑/↓
  // move through a dialog's options, Esc closes tend's pane.
  root.addEventListener("keydown", (e) => {
    const inButton = (e.target as HTMLElement).closest("button");
    if (e.key === "Escape" && tend) {
      e.preventDefault();
      act("close", panes.some((p) => p.contains(e.target as Node)));
    } else if (e.key === " " && !inButton) {
      e.preventDefault();
      playBtn.click();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      if (motion.matches) return seekWait(still + (e.key === "ArrowRight" ? 1 : -1));
      // Forth goes to the next wait, if any; back to the wait before the
      // moment on screen, past a second of it, or else to the start.
      if (e.key === "ArrowRight") {
        const k = marks.findIndex((m) => m.at > t + 0.05);
        if (k >= 0) seekWait(k);
      } else {
        const k = marks.findLastIndex((m) => m.at < t - 1);
        if (k >= 0) seekWait(k);
        else seek(0);
      }
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && playing().asking() && !motion.matches) {
      e.preventDefault();
      choose(playing().asking()!.cursor + (e.key === "ArrowDown" ? 1 : -1));
    }
  });

  motion.addEventListener("change", sync);
  // A layout change can pick another column count or row count; it redraws
  // the same moment, and moves the cursor with no glide.
  new ResizeObserver(() => {
    cols = picked();
    rows = fitted();
    jumped = true;
    draw();
  }).observe(root);

  // It plays only in view; out of view, it holds where it is, and an ended
  // demo stays on its last frame.
  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      sync();
    },
    { threshold: 0.4 },
  ).observe($("pair"));

  sync();
}
