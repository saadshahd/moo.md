import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  boxPixels,
  diagramBox,
  MAX_BYTES,
  MAX_PIXELS,
  rasterOf,
} from "./size.ts";
import { resolveVars, sizeSvg } from "./svg.ts";
import { themeVars } from "./theme.ts";

const PELE_ROOT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5" width="10" height="5" style="--_fg:var(--pele-fg,#1f1f1f);--_l:var(--pele-line,#222);color:var(--_fg)" fill="var(--_fg)"><path stroke="var(--_l)"/><text fill="var(--pele-fg-on-light, var(--_fg))">x</text></svg>';

describe("resolveVars", () => {
  test("both levels resolve: the theme's value first, the SVG's own declaration next", () => {
    const out = resolveVars(PELE_ROOT, { "--pele-fg": "rgb(1,2,3)" });

    expect(out).not.toContain("var(");
    expect(out).toContain('fill="rgb(1,2,3)"');
    expect(out).toContain('stroke="#222"');
  });

  test("an undeclared name takes its fallback, itself a var()", () => {
    expect(resolveVars(PELE_ROOT, { "--pele-fg": "red" })).toContain(
      '<text fill="red">',
    );
  });

  test("a name with no value and no fallback fails loud", () => {
    expect(() => resolveVars('<svg fill="var(--nope)"/>', {})).toThrow(
      /--nope has no value/,
    );
  });

  test("a variable that names itself fails loud", () => {
    expect(() =>
      resolveVars('<svg style="--a:var(--a)" fill="var(--a)"/>', {}),
    ).toThrow(/deeper than 8/);
  });

  test("one name declared twice with two values fails loud: scope is not modelled", () => {
    expect(() =>
      resolveVars('<svg style="--a:red"><g style="--a:blue"/></svg>', {}),
    ).toThrow(/declared twice/);
  });
});

test("sizeSvg sets the root's size and keeps the viewBox, top left", () => {
  const out = sizeSvg(PELE_ROOT, 320, 64);

  expect(out).toMatch(
    /^<svg width="320" height="64" preserveAspectRatio="xMinYMin meet" xmlns=/,
  );
  expect(out).toContain('viewBox="0 0 10 5"');
  expect(out.match(/\swidth="/g)).toHaveLength(1);
});

test("every theme fills every colour pele reads; an unknown theme goes by its name", () => {
  for (const name of [
    "dark",
    "light",
    "dark-daltonized",
    "light-daltonized",
    "dark-ansi",
    "custom",
  ]) {
    const vars = themeVars(name);

    for (const k of [
      "--pele-bg",
      "--pele-fg",
      "--pele-line",
      "--pele-surface",
      "--pele-accent",
      "--pele-series-8",
    ])
      expect(vars[k]).toMatch(/^rgb\(|^(sans-serif|monospace)$/);
  }
  expect(themeVars("light-ansi")["--pele-fg"]).toBe("rgb(0,0,0)");
  expect(themeVars("my-theme")["--pele-fg"]).toBe("rgb(255,255,255)");
});

describe("size", () => {
  test("a box is 16 by 32 device pixels a cell", () => {
    expect(boxPixels({ columns: 10, rows: 2 })).toEqual({
      width: 160,
      height: 64,
    });
  });

  test("a box over the pixel cap shrinks as a whole", () => {
    const px = boxPixels({ columns: 255, rows: 255 });

    expect(px.width * px.height).toBeLessThanOrEqual(MAX_PIXELS);
    expect(px.width / px.height).toBeCloseTo(0.5, 2);
  });

  test("a diagram's box is whole cells, 1 to 255", () => {
    expect(diagramBox(1, 1)).toEqual({ columns: 1, rows: 1 });
    expect(diagramBox(100_000, 10)).toEqual({ columns: 255, rows: 1 });
  });

  test("headers: PNG, GIF, JPEG sizes; anything else is null", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68,
      82, 0, 0, 1, 0, 0, 0, 0, 200,
    ]);
    const gif = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 10, 0, 20, 0,
    ]);
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 30, 0, 40, 3,
      0, 0,
    ]);

    expect(rasterOf(png)).toEqual({ mime: "png", width: 256, height: 200 });
    expect(rasterOf(gif)).toEqual({ mime: "gif", width: 10, height: 20 });
    expect(rasterOf(jpeg)).toEqual({ mime: "jpeg", width: 40, height: 30 });
    expect(rasterOf(new TextEncoder().encode("RIFF....WEBP"))).toBeNull();
  });
});

describe("draw.ts, run as the hook runs it", () => {
  const run = async (args: string[], stdin?: string) => {
    const p = Bun.spawn(["bun", `${import.meta.dir}/draw.ts`, ...args], {
      stdin: stdin === undefined ? "ignore" : new Blob([stdin]),
      stdout: "pipe",
      stderr: "pipe",
    });

    return {
      code: await p.exited,
      out: await new Response(p.stdout).text(),
      err: await new Response(p.stderr).text(),
    };
  };

  test("a flowchart becomes a PNG the size of its box, under the caps", async () => {
    const out = `${await mkdtemp(`${tmpdir()}/hold-draw-`)}/flow.png`;
    const r = await run(
      ["mermaid", "dark", out],
      "flowchart LR\n  A[Read] --> B{Image?}\n  B -->|yes| C[view]",
    );

    expect(r.code).toBe(0);
    const box = JSON.parse(r.out);
    const bytes = new Uint8Array(await Bun.file(out).arrayBuffer());

    expect(rasterOf(bytes)).toEqual({ mime: "png", ...boxPixels(box) });
    expect(bytes.length).toBeLessThanOrEqual(MAX_BYTES);
  });

  test("bad Mermaid exits 1 with pele's own words", async () => {
    const r = await run(
      ["mermaid", "dark", "/tmp/never.png"],
      "flowchart LR\n A-->",
    );

    expect(r.code).toBe(1);
    expect(r.err).toMatch(/Parse error/);
  });

  test("a JPEG becomes a PNG; a WebP is refused by name", async () => {
    const dir = await mkdtemp(`${tmpdir()}/hold-draw-`);
    const flow = `${dir}/flow.png`;

    await run(["mermaid", "light", flow], "flowchart LR\n  A --> B");
    const jpeg = `${dir}/in.jpg`;
    const conv = Bun.spawnSync([
      "sips",
      "-s",
      "format",
      "jpeg",
      flow,
      "--out",
      jpeg,
    ]);

    if (conv.exitCode === 0) {
      const r = await run(["picture", jpeg, `${dir}/out.png`]);

      expect(r.code).toBe(0);
      expect(
        rasterOf(new Uint8Array(await Bun.file(`${dir}/out.png`).arrayBuffer()))
          ?.mime,
      ).toBe("png");
    }
    await Bun.write(`${dir}/x.webp`, "RIFF....WEBPVP8 ");
    const w = await run(["picture", `${dir}/x.webp`, `${dir}/w.png`]);

    expect(w.code).toBe(1);
    expect(w.err).toMatch(/not a PNG, JPEG or GIF/);
  });
});
