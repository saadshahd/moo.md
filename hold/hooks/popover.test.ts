import { expect, test } from "claude-code/testing";
import { place, pngSize } from "./popover.ts";

/** A 1440 by 900 point screen at a scale of 2, its menu bar taking the top 25. */
const at = (x: number, y: number) => ({
  x,
  y,
  area: { x: 0, y: 25, width: 1440, height: 875 },
  scale: 2,
});
/** 400 by 200 device pixels: 200 by 100 points, 212 by 112 in the border. */
const PIC = { width: 400, height: 200 };

test("the window's left edge is at the pointer, and it opens 24 points below it", () => {
  expect(place(at(300, 200), PIC)).toEqual({ x: 300, y: 224, width: 212, height: 112 });
});

test("a pointer low on the screen, with more room above, opens the window above it", () => {
  expect(place(at(300, 850), PIC)).toEqual({ x: 300, y: 714, width: 212, height: 112 });
});

test("with too little room either side it stays below while below has more, shrunk to fit", () => {
  const r = place(at(300, 400), { width: 2000, height: 2000 });

  expect(r.y).toBe(424);
  expect(r.y + r.height).toBeLessThanOrEqual(900);
  expect(r.width).toBe(r.height);
});

test("near the right edge it moves left to stay on the screen", () => {
  expect(place(at(1400, 200), PIC).x).toBe(1440 - 212);
});

test("its longest side is 800 points at most", () => {
  const r = place(at(0, 30), { width: 4000, height: 1000 });

  expect(r.width).toBe(812);
});

test("a PNG's size is read off its header; other bytes have none", () => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

  expect(pngSize(png)).toEqual({ width: 1, height: 1 });
  expect(pngSize(btoa("GIF89a" + "\0".repeat(30)))).toBeNull();
});
