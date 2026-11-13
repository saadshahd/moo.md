/* A band piece that plays as one loop: keyframe tracks written as times in
   ms, drawn again from the drawing's width whenever it changes, held on one
   frame under reduced motion and paused while off screen or in a hidden tab.
   Every move is a transform or an opacity run by the Web Animations API, so
   the compositor plays it and the main thread does no work per frame. */
import { EASE, whileSeen } from "./clock";

/* One element's keyframes across a loop. `move` goes from the last values to
   new ones between two times; `jump` changes them at once. Every key carries
   every property. */
export class Track {
  private keys: { at: number; props: Keyframe; easing?: string }[];
  constructor(
    readonly el: Element,
    start: Keyframe,
  ) {
    this.keys = [{ at: 0, props: start }];
  }
  private get last() {
    return this.keys[this.keys.length - 1];
  }
  private hold(at: number) {
    if (at > this.last.at) this.keys.push({ at, props: this.last.props });
  }
  move(from: number, to: number, props: Keyframe, easing = EASE.inOut) {
    this.hold(from);
    this.last.easing = easing;
    this.keys.push({ at: to, props: { ...this.last.props, ...props } });
    return this;
  }
  jump(at: number, props: Keyframe) {
    this.hold(at);
    this.keys.push({ at, props: { ...this.last.props, ...props } });
    return this;
  }
  frames(length: number): Keyframe[] {
    this.hold(length);
    return this.keys.map(({ at, props, easing }) => ({
      ...props,
      offset: at / length,
      easing: easing ?? "linear",
    }));
  }
}

/* What one drawing plays: its tracks, the loop's length, and the time of the
   frame shown under reduced motion. */
export type Score = { tracks: Track[]; length: number; still: number };

/* A step of the site's spacing scale (identity.css), in px. */
export const space = (step: number) => {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        `--moo-space-${step}`,
      ),
    ) * rem
  );
};

/* An element placed in px inside its drawing. */
export function node(
  parent: Element,
  className: string,
  box: { x?: number; y?: number; w?: number; h?: number } = {},
  tag = "div",
) {
  const el = document.createElement(tag);
  el.className = className;
  const px = (n?: number) => (n === undefined ? "" : `${n}px`);
  Object.assign(el.style, {
    left: px(box.x),
    top: px(box.y),
    width: px(box.w),
    height: px(box.h),
  });
  parent.append(el);
  return el;
}

/* Plays `draw`'s score on a loop, and draws it again, at the same time in
   the loop, when `drawing` changes width. */
export function loop(
  piece: HTMLElement,
  drawing: HTMLElement,
  draw: () => Score,
) {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let anims: Animation[] = [];
  let seen = true;
  let width = -1;
  const seek = (ms: number) => anims.forEach((a) => (a.currentTime = ms));
  const run = () => {
    const at = Number(anims[0]?.currentTime ?? 0);
    anims.forEach((a) => a.cancel());
    const score = draw();
    anims = score.tracks.map((t) =>
      t.el.animate(t.frames(score.length), {
        duration: score.length,
        iterations: Infinity,
      }),
    );
    if (still || !seen) anims.forEach((a) => a.pause());
    seek(still ? score.still : at % score.length);
  };
  new ResizeObserver(() => {
    if (drawing.clientWidth === width) return;
    width = drawing.clientWidth;
    run();
  }).observe(drawing);
  if (still) return;
  whileSeen(piece, {
    pause: () => {
      seen = false;
      const at = Number(anims[0]?.currentTime ?? 0);
      anims.forEach((a) => a.pause());
      seek(at);
    },
    resume: () => {
      seen = true;
      anims.forEach((a) => a.play());
    },
  });
}

/* A list of tracks and the function that adds one to it. */
export function tracker() {
  const tracks: Track[] = [];
  const track = (el: Element, start: Keyframe) => {
    const t = new Track(el, start);
    tracks.push(t);
    return t;
  };
  return { tracks, track };
}
