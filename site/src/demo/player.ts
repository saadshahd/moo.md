// Plays a demo's scene once while it is in view, from its first ask to its
// last frame, on one clock `t`, with a player's controls under it: play and
// pause, replay once it ends, a timeline with a tick per beat, and speed. Beat captions narrate above; a chain's moves are
// chapters of the timeline; the terminal scrolls back like one; the reader
// can pick a dialog's option. Under reduced motion, the timeline steps through
// one still per beat instead. A demo with a plain turn plays it first; its
// "without moo" button steps back to the plain reply and forth to moo's
// hand-back. Demo.astro sets the columns and rows.
import { beatEnds, beatTimes, frame, phases, type Frame, type Row, type Seg } from "./render";
import type { Scene } from "./types";


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
/** A row; an option's rows carry its index, and its first row is the one a
 * listbox names as the option. */
const rowHtml = (r: Row, id = "", first = false) =>
  `<div class="row ${r.cls ?? ""}"${r.opt === undefined ? "" : ` data-opt="${r.opt}"`}${first ? ` id="${id}-opt-${r.opt}" role="option"` : ""}>${r.segs.map(segHtml).join("")}</div>`;
const optionRows = (rows: Row[], id: string, cursor: number) =>
  rows
    .map((r, k) => {
      const first = r.opt !== undefined && rows.findIndex((x) => x.opt === r.opt) === k;
      return rowHtml(r, id, first).replace('role="option"', `role="option" aria-selected="${r.opt === cursor}"`);
    })
    .join("");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
let demos = 0;

export function mount(root: HTMLElement) {
  const { scene, chips, without } = JSON.parse(root.dataset.demo!) as {
    scene: Scene;
    chips: { at: number; beat: number }[];
    /** When moo's hand-back and the plain reply stand, and when the move's turn starts typing. */
    without?: { handBack: number; plain: number; moveStarts: number };
  };
  const $ = <T extends HTMLElement>(k: string) => root.querySelector<T>(`[data-${k}]`)!;
  const term = $("term");
  const scroll = $("scroll");
  const bottom = $("bottom");
  const toast = $("toast");
  const caret = $("caret");
  const trail = $("trail");
  const keycaps = $("keys");
  const playBtn = $<HTMLButtonElement>("play");
  const withoutBtn = root.querySelector<HTMLButtonElement>("[data-without]");
  // Speeds are the speed group's buttons, each naming its own.
  const speedBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-speed]")];
  const nowEl = $("now");
  const knob = $("knob");
  $("total").textContent = clock(phases(scene).length);
  const track = $("track");
  const fill = $("fill");
  const probe = $("probe");
  const rail = $("rail");
  // A chain's moves, as chapters of the timeline (Demo.astro): a name on the
  // rail each, and one beside the time when the names don't fit there.
  const chapterEls = [...root.querySelectorAll<HTMLElement>("[data-chapters] > *")];
  const atEls = [...root.querySelectorAll<HTMLElement>("[data-at] > *")];
  if (chapterEls.length && chapterEls.length !== chips.length)
    throw new Error(`The timeline shows ${chapterEls.length} moves; the demo has ${chips.length}`);
  const beats = [...root.querySelectorAll<HTMLElement>("[data-beat]")];
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const id = `demo${++demos}`;
  const { length } = phases(scene);
  const times = beatTimes(scene);

  let t = 0;
  let last = 0;
  let speed = 1;
  let still = 0; // the still on screen under reduced motion
  // Under reduced motion, the moment held in place of a beat's still: the
  // hand-back or the plain reply the "without moo" button stepped to, until
  // the reader goes to a beat.
  let held: number | undefined;
  let inView = false;
  let userPaused = false;
  let following = true; // false while the reader has scrolled up to read
  let pick: number | undefined; // the option the reader put the cursor on
  let ticking = false;
  let html = ["", "", ""];
  const colsNow = () => Number(getComputedStyle(term).getPropertyValue("--cols"));
  const rowsNow = () => Number(getComputedStyle(root).getPropertyValue("--rows"));
  let cols = colsNow();
  let rows = rowsNow();
  let lit = -1; // the chapter of the move on screen
  let f: Frame | undefined;

  // A tick on the timeline per beat: a mark, not a target of its own, since
  // beats can sit closer than a finger. The timeline is the target, and the
  // arrow keys go from beat to beat. Chapters mark a chain's timeline instead.
  const ticks = (chapterEls.length ? [] : scene.beats).map(() => {
    const tick = document.createElement("span");
    tick.className = "tick";
    track.append(tick);
    return tick;
  });
  const tickAt = (k: number) => (motion.matches ? k / Math.max(1, beats.length - 1) : times[k] / length);
  const placeTicks = () => ticks.forEach((tick, k) => (tick.style.left = `${tickAt(k) * 100}%`));

  // A chapter runs from its move's start to the next one's, the first from the
  // timeline's start. The rail parts where each later one starts. Each name
  // sits centred on its chapter, inside the timeline; where two would touch,
  // the names leave the rail and the time names the move instead.
  const chapterStart = (k: number) => (k ? tickAt(chips[k].beat) : 0);
  function placeChapters() {
    if (!chapterEls.length) return;
    const starts = chips.map((_, k) => `${chapterStart(k) * 100}%`).slice(1);
    rail.style.maskImage = `linear-gradient(to right, ${starts
      .map((x) => `#000 calc(${x} - 1.5px), transparent calc(${x} - 1.5px) calc(${x} + 1.5px), #000 calc(${x} + 1.5px)`)
      .join(", ")})`;
    const w = track.clientWidth;
    let end = -Infinity;
    let fits = true;
    chapterEls.forEach((el, k) => {
      const mid = ((chapterStart(k) + (k + 1 < chips.length ? chapterStart(k + 1) : 1)) / 2) * w;
      const left = Math.min(Math.max(0, mid - el.offsetWidth / 2), w - el.offsetWidth);
      el.style.left = `${left}px`;
      fits &&= left >= end + 12;
      end = left + el.offsetWidth;
    });
    track.parentElement!.classList.toggle("tight", !fits);
  }
  new ResizeObserver(placeChapters).observe(track);
  document.fonts.ready.then(placeChapters);

  // Captions sit in a box of fixed lines (Demo.astro); text longer than its
  // box would be cut, so say so.
  function checkBoxes() {
    const box = beats[0]?.parentElement;
    const cut = beats.filter((b) => box && b.scrollHeight > box.clientHeight + 1);
    if (cut.length) console.error("Demo text longer than its box; give the box more lines in Demo.astro:", cut.map((el) => el.textContent));
  }

  // The columns the CSS picked and the rows Demo.astro's script set.
  function fit() {
    checkBoxes();
    if (colsNow() === cols && rowsNow() === rows) return;
    jumped = true;
    cols = colsNow();
    rows = rowsNow();
    html = ["", "", ""];
    draw();
  }

  // Follow the newest line the way a terminal does, unless the reader scrolled up.
  function stickToBottom() {
    const end = scroll.scrollHeight - scroll.clientHeight;
    if (following && Math.abs(scroll.scrollTop - end) > 1) scroll.scrollTop = end;
    scroll.classList.toggle("above", scroll.scrollTop > 0);
  }

  /** Under reduced motion, a beat's still: the last moment what it names is
   * on screen, whole, before the next beat takes over. */
  const ends = beatEnds(scene);
  const stillAt = (k: number) =>
    Math.max(times[k], Math.min(ends[k], times[k + 1] ?? length) - 0.05);

  function paint() {
    const reduced = motion.matches;
    root.classList.toggle("reduced", reduced);
    const now = reduced ? (held ?? stillAt(still)) : t;
    f = frame(scene, now, cols, pick, rows);
    if (reduced && held !== undefined) still = f.beat;
    const next = [
      f.transcript.map((r) => rowHtml(r)).join(""),
      f.asking ? optionRows(f.bottom, id, f.asking.cursor) : f.bottom.map((r) => rowHtml(r)).join(""),
      f.toast ? `<div class="box">${f.toast.rows.map((r) => rowHtml(r)).join("")}</div>` : "",
    ];
    if (next[0] !== html[0]) scroll.innerHTML = next[0];
    if (next[1] !== html[1]) bottom.innerHTML = next[1];
    if (next[2] !== html[2]) toast.innerHTML = next[2];
    html = next;
    // A dialog's options are a listbox the arrow keys move through.
    if (f.asking) {
      bottom.setAttribute("role", "listbox");
      bottom.setAttribute("aria-label", "Options");
      bottom.setAttribute("aria-activedescendant", `${id}-opt-${f.asking.cursor}`);
    } else ["role", "aria-label", "aria-activedescendant"].forEach((a) => bottom.removeAttribute(a));
    // Sliding in from the right edge, the box's left part shows first.
    const box = toast.firstElementChild as HTMLElement | null;
    if (box) box.style.transform = `translateX(${(1 - f.toast!.slide) * 100}%)`;
    beats.forEach((b, k) => {
      b.classList.toggle("on", k === f!.beat);
      b.style.setProperty("--in", k === f!.beat ? String(f!.caption) : "0");
    });
    // The fill, its knob and the time readout show where the demo is.
    const at = `${(reduced ? still / Math.max(1, beats.length - 1) : t / length) * 100}%`;
    fill.style.width = at;
    knob.style.left = at;
    nowEl.textContent = clock(now);
    const move = lightChapter(Math.max(0, chips.findLastIndex((c) => c.at <= now)));
    if (reduced) {
      track.setAttribute("aria-valuenow", String(still + 1));
      track.setAttribute("aria-valuetext", `${move ? `${move}: ` : ""}${scene.beats[still].text}`);
    } else {
      track.setAttribute("aria-valuenow", String(Math.floor(t)));
      track.setAttribute("aria-valuetext", `${clock(t)}${move ? `, ${move}` : ` of ${clock(length)}`}: ${scene.beats[f.beat].text}`);
    }
    // Keys fade in and out with the clock, so a still shows none.
    keycaps.innerHTML = reduced
      ? ""
      : f.keys.map((k) => `<kbd style="opacity:${k.fade}">${esc(k.label)}</kbd>`).join("");
    // Pressed while the plain reply is on screen, before the move is typed.
    withoutBtn?.setAttribute("aria-pressed", String(now < without!.moveStarts));
    stickToBottom();
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
    const box = term.getBoundingClientRect();
    const top = first.getBoundingClientRect().top - box.top - keycaps.offsetHeight - 4;
    keycaps.style.top = `${Math.max(parseFloat(getComputedStyle(term).paddingTop), top)}px`;
  }

  // The chapter on screen lights up, on the rail and beside the time; its
  // name, if the timeline has chapters.
  function lightChapter(k: number) {
    if (k !== lit) {
      lit = k;
      [chapterEls, atEls].forEach((els) => els.forEach((el, i) => el.classList.toggle("on", i === k)));
    }
    return chapterEls[k]?.textContent ?? "";
  }

  // The cursor glides to its cell, leaving a short smear, and blinks softly
  // once at rest; it inverts the text under it, so it covers none.
  let at = "";
  let rest: number | undefined;
  function placeCaret() {
    const c = f?.cursor;
    const row = c && (bottom.children[c.row] as HTMLElement | undefined);
    caret.hidden = trail.hidden = !row;
    if (!row || !c) return;
    const box = term.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const cell = probe.firstElementChild!.getBoundingClientRect().width / 10;
    const x = r.left - box.left + c.col * cell;
    const y = r.top - box.top;
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
      jumped = false;
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
  let hue = 0;
  let jumped = true;

  // Scrolling up pauses the demo so the text holds still; back at the bottom, it
  // resumes. Only scrolls that follow the reader's own input count.
  let lastInput = -Infinity;
  for (const type of ["wheel", "touchmove", "keydown", "pointerdown"])
    scroll.addEventListener(type, () => (lastInput = performance.now()), { passive: true });
  scroll.addEventListener("scroll", () => {
    scroll.classList.toggle("above", scroll.scrollTop > 0);
    if (motion.matches || performance.now() - lastInput > 800) return;
    const atBottom = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop <= 2;
    if (atBottom !== following) {
      following = atBottom;
      sync();
    }
  });

  const ended = () => t >= length;
  const running = () => inView && !userPaused && following && !motion.matches && !ended();

  // A frame that fails to draw says so in the terminal, and the demo stops.
  function draw() {
    try {
      paint();
    } catch (e) {
      userPaused = true;
      scroll.innerHTML = `<div class="row"><span class="o">This demo failed to draw: ${esc(String(e))}</span></div>`;
      bottom.innerHTML = "";
      throw e;
    }
  }

  function tick(now: number) {
    if (!running()) {
      ticking = false;
      return;
    }
    // A frame's timestamp can precede the performance.now() taken when play began.
    t = Math.min(length, t + (Math.max(0, now - last) / 1000) * speed);
    last = now;
    // At the end the demo holds its last frame, and play becomes replay.
    if (ended()) sync();
    else draw();
    requestAnimationFrame(tick);
  }

  function sync() {
    const paused = userPaused || !following;
    playBtn.textContent = ended() ? "↻" : paused ? "▶" : "❚❚";
    playBtn.setAttribute("aria-label", ended() ? "Replay demo" : paused ? "Play demo" : "Pause demo");
    speedBtns.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === speed)));
    placeTicks();
    placeChapters();
    track.setAttribute("aria-valuemax", String(motion.matches ? beats.length : Math.floor(length)));
    track.setAttribute("aria-valuemin", motion.matches ? "1" : "0");
    if (running() && !ticking) {
      ticking = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
    draw();
  }

  /** Jump to time `s`; a reader's pick no longer applies. Playing stays playing. */
  function seek(s: number) {
    jumped = true;
    t = Math.min(Math.max(0, s), length);
    pick = undefined;
    following = true;
    last = performance.now();
    // A seek can end the demo or take it back from its end.
    sync();
  }
  function seekBeat(k: number) {
    if (motion.matches) {
      still = Math.min(Math.max(0, k), beats.length - 1);
      held = undefined;
      pick = undefined;
      draw();
    // Past the caption's fade-in, so a paused demo shows it.
    } else seek(times[Math.min(Math.max(0, k), times.length - 1)] + 0.3);
  }
  const beatNow = () => (motion.matches ? still : (f?.beat ?? 0));

  // Play always returns to the newest line and lets the demo drive the dialog;
  // at the end, it replays from the first ask.
  // The glyph of the state play or pause just put the demo in, shown in the
  // terminal's centre, then faded.
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
    } else if (userPaused || !following) {
      userPaused = false;
      following = true;
      pick = undefined;
    } else userPaused = true;
    sync();
    flashState();
  });

  // A click on the terminal plays or pauses it, as on a video, unless it picks
  // a dialog's option, ends a drag that scrolled, or ends selecting text.
  let down: { x: number; y: number; top: number } | undefined;
  term.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY, top: scroll.scrollTop }));
  term.addEventListener("click", (e) => {
    const moved = down && (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4 || scroll.scrollTop !== down.top);
    if (motion.matches || moved || getSelection()?.toString() || (e.target as HTMLElement).closest("[data-opt]")) return;
    playBtn.click();
  });
  // A step between the plain reply and moo's hand-back: it pauses there.
  withoutBtn?.addEventListener("click", () => {
    const to = withoutBtn.getAttribute("aria-pressed") === "true" ? without!.handBack : without!.plain;
    userPaused = true;
    held = to;
    if (!motion.matches) seek(to);
    sync();
  });
  speedBtns.forEach((b) =>
    b.addEventListener("click", () => {
      speed = Number(b.dataset.speed);
      sync();
    }),
  );

  // The timeline seeks where it is pressed, and follows a drag; a press within
  // half a fingertip (12px) of a tick goes to that beat.
  const seekTo = (e: PointerEvent) => {
    const r = track.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const near = ticks
      .map((_, k) => ({ k, d: Math.abs(tickAt(k) - x) * r.width }))
      .filter(({ d }) => d <= 12)
      .sort((a, b) => a.d - b.d)[0];
    if (near) seekBeat(near.k);
    else if (motion.matches) seekBeat(Math.round(x * (beats.length - 1)));
    else seek(x * length);
  };
  // On a chain's timeline, a tap goes to its chapter's start (a name's own,
  // since a name may reach past its chapter) and a drag scrubs.
  let tap: { x: number; k: number } | undefined;
  const chapterAt = (e: PointerEvent) => {
    const named = chapterEls.indexOf((e.target as HTMLElement).closest<HTMLElement>("[data-chapters] > *")!);
    const x = (e.clientX - track.getBoundingClientRect().left) / track.clientWidth;
    return named >= 0 ? named : Math.max(0, chips.findLastIndex((_, k) => chapterStart(k) <= x));
  };
  track.addEventListener("pointerdown", (e) => {
    track.setPointerCapture(e.pointerId);
    if (chapterEls.length) tap = { x: e.clientX, k: chapterAt(e) };
    else seekTo(e);
  });
  track.addEventListener("pointermove", (e) => {
    if (!track.hasPointerCapture(e.pointerId) || (tap && Math.abs(e.clientX - tap.x) <= 4)) return;
    tap = undefined;
    seekTo(e);
  });
  track.addEventListener("pointerup", () => {
    if (tap) seekBeat(chips[tap.k].beat);
    tap = undefined;
  });

  // Picking an option pauses the demo and moves the dialog's cursor to it.
  const choose = (k: number) => {
    if (!f?.asking) return;
    pick = Math.min(Math.max(0, k), f.asking.options - 1);
    userPaused = true;
    sync();
  };
  bottom.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-opt]");
    if (row) choose(Number(row.dataset.opt));
  });

  // Keys: Space plays or pauses, ←/→ go to the previous or next beat, ↑/↓
  // move through a dialog's options.
  root.addEventListener("keydown", (e) => {
    const inButton = (e.target as HTMLElement).closest("button");
    if (e.key === " " && !inButton) {
      e.preventDefault();
      playBtn.click();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const k = beatNow();
      const into = motion.matches ? 0 : t - times[k];
      // Back from inside a beat goes to its start; from its start, the one before.
      seekBeat(e.key === "ArrowRight" ? k + 1 : into > 1 ? k : k - 1);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && f?.asking && !motion.matches) {
      e.preventDefault();
      choose(f.asking.cursor + (e.key === "ArrowDown" ? 1 : -1));
    }
  });

  motion.addEventListener("change", sync);
  checkBoxes();
  new ResizeObserver(fit).observe(root);
  root.addEventListener("fit", fit);

  // It plays only in view; out of view, it holds where it is, and an ended
  // demo stays on its last frame.
  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      sync();
    },
    { threshold: 0.4 },
  ).observe(term);

  sync();
}
