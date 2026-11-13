/* The band pieces' two curves: out for what arrives, in-out for what moves
   from one place to another. */
export const EASE = {
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
};

/* Every animation and wait a stepped piece starts goes through one Clock, so
   pausing it stops them all, waits included. Every move is a transform or an
   opacity run by the Web Animations API: the compositor plays it, and the
   main thread does no work per frame. */
export class Clock {
  private live = new Set<Animation>();
  private held: Animation[] = [];
  private stopped = false;
  constructor(private stage: HTMLElement) {}
  play(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation {
    const a = el.animate(frames, { fill: "forwards", ...opts });
    if (this.stopped) {
      a.pause();
      this.held.push(a);
    }
    this.live.add(a);
    const forget = () => this.live.delete(a);
    a.finished.then(forget, forget);
    return a;
  }
  wait(ms: number): Promise<unknown> {
    return this.play(this.stage, [], { duration: ms }).finished.catch(() => {});
  }
  pause() {
    this.stopped = true;
    this.held = [...this.live].filter((a) => a.playState === "running");
    this.held.forEach((a) => a.pause());
  }
  resume() {
    this.stopped = false;
    this.held.forEach((a) => a.play());
    this.held = [];
  }
}

/* Runs `resume` while the stage is on screen and the tab is shown, `pause`
   otherwise. */
export function whileSeen(stage: HTMLElement, { pause, resume }: { pause(): void; resume(): void }) {
  let onScreen = false;
  let running = true;
  const update = () => {
    const show = onScreen && !document.hidden;
    if (show === running) return;
    running = show;
    (show ? resume : pause)();
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    update();
  }).observe(stage);
  document.addEventListener("visibilitychange", update);
  update();
}
