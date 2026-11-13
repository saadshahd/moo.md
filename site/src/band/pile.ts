/* hold's band piece: what you end up holding. moo off: the agent drops block
   after block of amber code onto a crooked pile, faster than you could open
   one, and the pile stays, signed for. moo on: each block comes back as a
   choice of two outlined previews; the cursor that is you walks to them,
   waits, and picks the answer the session recommended; the pick turns pine,
   takes the name of the question it answers, and settles onto a straight
   stack, the cursor riding with it. The loop ends on both: a tall pile you
   signed for, a short stack you own. BandPile.astro draws the columns; this
   draws the blocks and plays the loop. */
import { EASE } from "./clock";
import { loop, node, space, tracker, type Score } from "./loop";

const CURSOR = { w: 12, h: 24 };
const FALL = "cubic-bezier(0.5, 0, 0.75, 0)";
/* The pile's lean, from the floor up: each block's step in from the column's
   edge, and how far its right end sits above its left, both in px, so the
   tilt reads the same at every width. */
const LEAN: [number, number][] = [
  [0, 0],
  [6, 4],
  [1, -5],
  [12, 6],
  [4, -3],
  [16, 7],
  [7, -6],
];
/* Each block's two code lines, as shares of its width. */
const LINES: [number, number][] = [
  [0.55, 0.36],
  [0.7, 0.27],
  [0.45, 0.57],
  [0.62, 0.39],
  [0.36, 0.64],
];
const AT = { off: 300, offEach: 110, offEnd: 2000, rest: 2600 };

const place = (x: number, y: number, r = 0) => ({
  transform: `translate(${x}px, ${y}px) rotate(${r}deg)`,
});
const seen = (o: number) => ({ opacity: o });

export function mount(pile: HTMLElement) {
  const yard = pile.querySelector<HTMLElement>(".pile-yard")!;
  const col = (side: string) =>
    pile.querySelector<HTMLElement>(`[data-col="${side}"]`)!;
  const label = (side: string) =>
    pile.querySelector<HTMLElement>(`[data-label="${side}"]`)!;
  const names: string[] = JSON.parse(pile.dataset.names!);
  const picks: number[] = JSON.parse(pile.dataset.picks!);

  const draw = (): Score => {
    const off = col("off");
    const on = col("on");
    off.replaceChildren();
    on.replaceChildren();
    const { tracks, track } = tracker();
    const h = 1.5 * space(4);
    const pitch = h + space(1);
    const floor = yard.clientHeight - h;
    const lean = Math.max(...LEAN.map(([dx]) => dx));
    const pileW = off.clientWidth - lean;
    const stackW = on.clientWidth - CURSOR.w - space(2);

    const block = (parent: Element, n: number, w: number, faces: string[]) => {
      const outer = node(parent, "pile-block", { w, h });
      const [a, b] = LINES[n % LINES.length];
      const out = faces.map((tone) => {
        const face = node(outer, `pile-face ${tone}`);
        if (tone === "pine") return face;
        node(face, "pile-bar", {
          y: h / 2 - space(1) * 1.5,
          w: a * (w - 2 * space(2)),
        });
        node(face, "pile-bar", {
          y: h / 2 + space(1) * 0.5,
          w: b * (w - 2 * space(2)),
        });
        return face;
      });
      return { outer, faces: out };
    };

    /* moo off: one block every 110ms onto the leaning pile. */
    LEAN.forEach(([dx, rise], k) => {
      const r = (-Math.atan2(rise, pileW) * 180) / Math.PI;
      const { outer, faces } = block(off, k, pileW, ["amber"]);
      const y = floor - k * pitch;
      const s = AT.off + k * AT.offEach;
      track(outer, place(dx, y - space(6), r)).move(
        s,
        s + 420,
        place(dx, y, r),
        FALL,
      );
      track(faces[0], seen(0)).move(s, s + 160, seen(1), EASE.out);
    });

    /* moo on: each block comes back as two previews; the cursor picks one,
       and it settles, named, onto the stack. */
    const cursorX = on.clientWidth - CURSOR.w;
    const rowY = (k: number) => k * pitch;
    const cur = track(node(on, "band-cursor", { w: CURSOR.w, h: CURSOR.h }), {
      ...place(cursorX, rowY(0)),
      ...seen(0),
    }).move(AT.offEnd + 300, AT.offEnd + 500, seen(1), EASE.out);
    let t0 = AT.offEnd + 600;
    names.forEach((name, r) => {
      const pick = picks[r];
      const choices = [0, 1].map((k) => {
        const { outer, faces } = block(on, 2 * r + k + 1, stackW, [
          "ghost",
          "pine",
        ]);
        faces[1].textContent = name;
        const at = t0 + k * 60;
        return {
          outer: track(outer, place(0, rowY(k) - space(2))).move(
            at,
            at + 380,
            place(0, rowY(k)),
            EASE.out,
          ),
          ghost: track(faces[0], seen(0)).move(at, at + 200, seen(1), EASE.out),
          own: track(faces[1], seen(0)),
        };
      });
      if (r > 0) cur.move(t0 + 100, t0 + 600, place(cursorX, rowY(0)));
      let t = t0 + 700;
      for (let k = 0; k < 2; k++)
        cur
          .move(t + k * 480, t + 60 + k * 480, seen(0.15), "linear")
          .move(t + 240 + k * 480, t + 300 + k * 480, seen(1), "linear");
      t += 1000;
      if (pick === 1) {
        cur.move(t, t + 200, place(cursorX, rowY(1)));
        t += 300;
      }
      const chosen = choices[pick];
      chosen.own.move(t, t + 200, seen(1), EASE.out);
      chosen.ghost.move(t, t + 200, seen(0), EASE.out);
      choices[1 - pick].ghost.move(t, t + 200, seen(0), EASE.out);
      t += 300;
      const slot = floor - r * pitch;
      chosen.outer.move(t, t + 450, place(0, slot));
      cur.move(t, t + 450, place(cursorX, slot));
      t0 = t + 550;
    });

    const length = t0 + AT.rest;
    const fade = length - 400;
    track(off, seen(1))
      .move(AT.offEnd, AT.offEnd + 300, seen(0.32), EASE.out)
      .move(fade, fade + 300, seen(0), EASE.out);
    track(label("on"), seen(0.4))
      .move(AT.offEnd + 200, AT.offEnd + 500, seen(1), EASE.out)
      .move(fade, fade + 300, seen(0.4), EASE.out);
    track(on, seen(1)).move(fade, fade + 300, seen(0), EASE.out);
    cur.move(fade, fade + 300, seen(0), EASE.out);

    return { tracks, length, still: length - 900 };
  };

  loop(pile, yard, draw);
}
